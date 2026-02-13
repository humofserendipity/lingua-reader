import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

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
});

const updatePositionSchema = z.object({
  currentPosition: z.string(),
  currentChapter: z.string().optional(),
});

const reviewSchema = z.object({
  correct: z.boolean(),
});

function getSystemPrompt(action: string): string {
  const base = "You are a Spanish language tutor helping an intermediate learner understand Spanish text. Always respond in English unless showing the original Spanish text.";

  switch (action) {
    case "translate":
      return `${base} Translate the selected Spanish text into natural English. Show the original text and translation clearly. If it's a single word, also provide common alternative meanings.`;
    case "quick-grammar":
      return `${base} Provide a brief grammatical breakdown of the selected text. For each verb, state: tense, mood, root verb (infinitive), and a short note on why this form is used. For idiomatic expressions, explain the meaning. Keep it concise — use bullet points.`;
    case "deep-grammar":
      return `${base} Provide a full linguistic analysis of the selected text:
1. Full sentence parse: subject, verb, object, modifiers
2. Conjugation details for every verb (person, number, tense, mood)
3. Explain why this tense/mood was chosen vs. alternatives
4. Idiomatic expressions and cultural notes
5. Comparison to English sentence structure
Be thorough but clear.`;
    default:
      return base;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.post("/api/books/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const originalName = file.originalname.replace(/\.epub$/i, "");
      const book = await storage.createBook({
        userId,
        title: originalName,
        author: null,
        fileType: "epub",
        fileName: file.filename,
        currentPosition: null,
        currentChapter: null,
      });

      res.json(book);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.get("/api/books", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userBooks = await storage.getBooksByUser(userId);
      res.json(userBooks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id, userId);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/books/:id/file", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id, userId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      const filePath = path.join(uploadDir, book.fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.sendFile(filePath);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const parsed = updatePositionSchema.parse(req.body);

      const book = await storage.getBook(id, userId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      const updated = await storage.updateBookPosition(id, parsed.currentPosition, parsed.currentChapter);
      if (!updated) return res.status(404).json({ message: "Book not found" });
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/books/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const content = event.delta.text;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
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
      const userId = req.user.claims.sub;
      const parsed = saveVocabSchema.parse(req.body);
      const { text, context, type, bookId } = parsed;

      const isWord = type === "word";
      const systemPrompt = isWord
        ? "You are a Spanish language tutor. For the given Spanish word, provide a JSON response with these fields: translation (English), partOfSpeech (noun, verb, adjective, etc.), exampleSentence (the sentence from the book where this word appears, or create one if not available). Respond ONLY with valid JSON, no markdown."
        : "You are a Spanish language tutor. For the given Spanish sentence/passage, provide a JSON response with these fields: translation (English translation), grammarNotes (a clear breakdown of the syntax, verb forms, and sentence structure explaining the underlying logic). Respond ONLY with valid JSON, no markdown.";

      const userMessage = context
        ? `Context: "${context}"\n\nSelected ${type}: "${text}"`
        : `Selected ${type}: "${text}"`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      let aiData: any = {};
      const textContent = response.content[0];
      if (textContent.type === "text") {
        try {
          aiData = JSON.parse(textContent.text);
        } catch {
          aiData = { translation: textContent.text };
        }
      }

      const vocabItem = await storage.createVocabItem({
        userId,
        bookId: bookId || null,
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

  app.get("/api/vocab", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getVocabItems(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/vocab/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteVocabItem(id, userId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vocab/:id/review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
