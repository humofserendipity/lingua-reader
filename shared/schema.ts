export * from "./models/auth";

import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  author: text("author"),
  fileType: text("file_type").notNull(),
  fileName: text("file_name").notNull(),
  currentPosition: text("current_position"),
  currentChapter: text("current_chapter"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const vocabItems = pgTable("vocab_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  bookId: integer("book_id").references(() => books.id),
  chapter: text("chapter"),
  type: text("type").notNull(),
  originalText: text("original_text").notNull(),
  translation: text("translation"),
  grammarNotes: text("grammar_notes"),
  partOfSpeech: text("part_of_speech"),
  exampleSentence: text("example_sentence"),
  context: text("context"),
  reviewStatus: text("review_status").default("new").notNull(),
  timesReviewed: integer("times_reviewed").default(0).notNull(),
  timesCorrect: integer("times_correct").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastReviewedAt: timestamp("last_reviewed_at"),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
});

export const insertVocabItemSchema = createInsertSchema(vocabItems).omit({
  id: true,
  createdAt: true,
  lastReviewedAt: true,
});

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type VocabItem = typeof vocabItems.$inferSelect;
export type InsertVocabItem = z.infer<typeof insertVocabItemSchema>;
