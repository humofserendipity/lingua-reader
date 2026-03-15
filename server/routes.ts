import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import type { Book } from "@shared/schema";

const serializeBook = ({ fileContent: _, ...book }: Book) => book;

// Local dev: auth disabled — all requests treated as a single local user
const LOCAL_USER_ID = "local-user";
const isAuthenticated = (_req: Request, _res: Response, next: NextFunction) => next();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".epub") {
      cb(null, true);
    } else {
      cb(new Error("Only EPUB files are supported"));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const analyzeSchema = z.object({
  text: z.string().min(1),
  context: z.string().optional(),
  action: z.enum(["translate", "quick-grammar", "deep-grammar"]),
});

const saveVocabSchema = z.object({
  text: z.string().min(1),
  context: z.string().optional(),
  type: z.enum(["word", "sentence"]),
  bookId: z.number().nullable().optional(),
  chapter: z.string().nullable().optional(),
});

const updatePositionSchema = z.object({
  currentPosition: z.string(),
  currentChapter: z.string().optional(),
});

const reviewSchema = z.object({
  correct: z.boolean(),
});

function getSystemPrompt(action: string): string {
  const base = "You are a Spanish language tutor helping an intermediate learner understand Spanish text. Always respond in English unless showing the original Spanish text. Be concise and direct.";

  switch (action) {
    case "translate":
      return `${base}

For the selected Spanish text, respond with this exact format:

**Translation**
[Natural English translation]

**Word-by-word**
| Spanish | English | Notes |
|---------|---------|-------|
[one row per key word]

If it is a single word, add a **Also means** line listing 2-3 alternative meanings separated by commas. Skip the table for single words and instead show: *[part of speech]* — [primary meaning]. Keep the total response under 150 words.`;

    case "quick-grammar":
      return `${base}

For each verb in the selected text, show:
**[verb form]** ← [infinitive], [tense & mood], [person/number]
> [one sentence explaining why this form is used here]

For any idiom or unusual construction, add a bullet point explaining it. Maximum 5 bullet points total. No full sentence paragraphs — use the structured format above only.`;

    case "deep-grammar":
      return `${base}

Analyse the selected text with these sections (use markdown headers):

## Sentence Structure
Subject | Verb phrase | Object/Complement — one line each with labels.

## Verb Table
| Form | Infinitive | Person | Tense | Mood | Why used |
|------|-----------|--------|-------|------|----------|
[one row per verb]

## Key Points
- [idiomatic expressions, subjunctive triggers, ser vs estar, por vs para, etc. — one bullet per item, max 5]

## English Comparison
One short paragraph on how this differs from English word order or grammar.

Be precise. Avoid filler. Total response under 300 words.`;

    default:
      return base;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Ensure the local dev user exists in the DB (needed for FK constraints)
  await db.insert(users).values({ id: LOCAL_USER_ID, email: "local@dev.local", firstName: "Local", lastName: "Dev" }).onConflictDoNothing();

  // Mock auth endpoint so the client thinks it's logged in
  app.get("/api/auth/user", (_req, res) => {
    res.json({ id: LOCAL_USER_ID, email: "local@dev.local", firstName: "Local", lastName: "Dev", profileImageUrl: null });
  });

  app.post("/api/books/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const originalName = file.originalname.replace(/\.epub$/i, "");
      const fileBuffer = await fs.promises.readFile(file.path);
      const fileContent = fileBuffer.toString("base64");
      await fs.promises.unlink(file.path);
      const book = await storage.createBook({
        userId,
        title: originalName,
        author: null,
        fileType: "epub",
        fileName: file.filename,
        fileContent,
        currentPosition: null,
        currentChapter: null,
      });

      res.json(serializeBook(book));
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.get("/api/books", isAuthenticated, async (_req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const userBooks = await storage.getBooksByUser(userId);
      res.json(userBooks.map(serializeBook));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id, userId);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(serializeBook(book));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/books/:id/file", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id, userId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      if (!book.fileContent) {
        return res.status(404).json({ message: "File content missing — please re-upload this book" });
      }

      const buffer = Buffer.from(book.fileContent, "base64");
      res.setHeader("Content-Type", "application/epub+zip");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updatePositionSchema.parse(req.body);

      const updated = await storage.updateBookPosition(id, parsed.currentPosition, parsed.currentChapter);
      if (!updated) return res.status(404).json({ message: "Book not found" });
      res.json(serializeBook(updated));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id, userId);
      if (book) {
        const filePath = path.join(uploadDir, book.fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await storage.deleteBook(id, userId);
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = analyzeSchema.parse(req.body);
      const { text, context, action } = parsed;

      const systemPrompt = getSystemPrompt(action);
      const userMessage = context
        ? `Here is the surrounding context:\n"${context}"\n\nThe user selected this text:\n"${text}"`
        : `The user selected this text:\n"${text}"`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const model = genai.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: systemPrompt });
      const stream = await model.generateContentStream(userMessage);

      for await (const chunk of stream.stream) {
        const content = chunk.text();
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("AI analyze error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "AI analysis failed. Please try again." })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: error.message || "AI analysis failed" });
      }
    }
  });

  app.post("/api/ai/save-vocab", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const parsed = saveVocabSchema.parse(req.body);
      const { text, context, type, bookId, chapter } = parsed;

      const isWord = type === "word";
      const systemPrompt = isWord
        ? `You are a Spanish language tutor. The user selected a Spanish word from a book. Identify the single word being studied. Respond with ONLY a raw JSON object (no markdown, no code fences, no extra text). JSON fields: "translation" (concise English translation of the word), "partOfSpeech" (noun/verb/adjective/etc.), "exampleSentence" (a short Spanish sentence using the word).`
        : `You are a Spanish language tutor. The user selected a Spanish sentence or passage from a book. Respond with ONLY a raw JSON object (no markdown, no code fences, no extra text). JSON fields: "translation" (natural English translation), "grammarNotes" (brief breakdown of key grammar points, verb tenses, and structure).`;

      const userMessage = context
        ? `Context from book: "${context}"\n\nSelected ${type}: "${text}"`
        : `Selected ${type}: "${text}"`;

      const vocabModel = genai.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: systemPrompt });
      const response = await vocabModel.generateContent(userMessage);

      let aiData: any = {};
      let rawText = response.response.text().trim();
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        aiData = JSON.parse(rawText);
      } catch {
        aiData = { translation: rawText };
      }

      const vocabItem = await storage.createVocabItem({
        userId,
        bookId: bookId || null,
        chapter: chapter || null,
        type,
        originalText: text,
        translation: aiData.translation || null,
        grammarNotes: aiData.grammarNotes || null,
        partOfSpeech: aiData.partOfSpeech || null,
        exampleSentence: aiData.exampleSentence || null,
        context: context || null,
        reviewStatus: "new",
        timesReviewed: 0,
        timesCorrect: 0,
      });

      res.json({ message: `${isWord ? "Word" : "Sentence"} saved!`, vocab: vocabItem });
    } catch (error: any) {
      console.error("Save vocab error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message || "Failed to save vocabulary" });
    }
  });

  app.get("/api/vocab", isAuthenticated, async (_req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const items = await storage.getVocabItems(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/vocab/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const id = parseInt(req.params.id);
      await storage.deleteVocabItem(id, userId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vocab/:id/review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = LOCAL_USER_ID;
      const id = parseInt(req.params.id);
      const parsed = reviewSchema.parse(req.body);
      const updated = await storage.updateVocabReview(id, userId, parsed.correct);
      if (!updated) return res.status(404).json({ message: "Vocab item not found" });
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
