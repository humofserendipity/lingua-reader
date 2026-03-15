import {
  books, vocabItems,
  type Book, type InsertBook,
  type VocabItem, type InsertVocabItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  createBook(book: InsertBook): Promise<Book>;
  getBook(id: number, userId?: string): Promise<Book | undefined>;
  getBooksByUser(userId: string): Promise<Book[]>;
  updateBookPosition(id: number, position: string, chapter?: string): Promise<Book | undefined>;
  deleteBook(id: number, userId: string): Promise<void>;

  createVocabItem(item: InsertVocabItem): Promise<VocabItem>;
  getVocabItems(userId: string): Promise<VocabItem[]>;
  getVocabItem(id: number): Promise<VocabItem | undefined>;
  deleteVocabItem(id: number, userId: string): Promise<void>;
  updateVocabReview(id: number, userId: string, correct: boolean): Promise<VocabItem | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createBook(book: InsertBook): Promise<Book> {
    const [created] = await db.insert(books).values(book).returning();
    return created;
  }

  async getBook(id: number, userId?: string): Promise<Book | undefined> {
    if (userId) {
      const [book] = await db.select().from(books).where(and(eq(books.id, id), eq(books.userId, userId)));
      return book;
    }
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }

  async getBooksByUser(userId: string): Promise<Book[]> {
    return db.select().from(books).where(eq(books.userId, userId)).orderBy(desc(sql`COALESCE(${books.lastOpenedAt}, ${books.createdAt})`));
  }

  async updateBookPosition(id: number, position: string, chapter?: string): Promise<Book | undefined> {
    const values: Partial<Book> = { currentPosition: position, lastOpenedAt: new Date() };
    if (chapter !== undefined) values.currentChapter = chapter;
    const [updated] = await db.update(books).set(values).where(eq(books.id, id)).returning();
    return updated;
  }

  async deleteBook(id: number, userId: string): Promise<void> {
    await db.delete(vocabItems).where(and(eq(vocabItems.bookId, id), eq(vocabItems.userId, userId)));
    await db.delete(books).where(and(eq(books.id, id), eq(books.userId, userId)));
  }

  async createVocabItem(item: InsertVocabItem): Promise<VocabItem> {
    const [created] = await db.insert(vocabItems).values(item).returning();
    return created;
  }

  async getVocabItems(userId: string): Promise<VocabItem[]> {
    return db.select().from(vocabItems).where(eq(vocabItems.userId, userId)).orderBy(desc(vocabItems.createdAt));
  }

  async getVocabItem(id: number): Promise<VocabItem | undefined> {
    const [item] = await db.select().from(vocabItems).where(eq(vocabItems.id, id));
    return item;
  }

  async deleteVocabItem(id: number, userId: string): Promise<void> {
    await db.delete(vocabItems).where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)));
  }

  async updateVocabReview(id: number, userId: string, correct: boolean): Promise<VocabItem | undefined> {
    const [item] = await db.select().from(vocabItems).where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)));
    if (!item) return undefined;

    const newTimesReviewed = item.timesReviewed + 1;
    const newTimesCorrect = item.timesCorrect + (correct ? 1 : 0);
    let newStatus = item.reviewStatus;
    if (correct && newTimesCorrect >= 3) {
      newStatus = "known";
    } else if (newTimesReviewed > 0) {
      newStatus = "learning";
    }

    const [updated] = await db
      .update(vocabItems)
      .set({
        timesReviewed: newTimesReviewed,
        timesCorrect: newTimesCorrect,
        reviewStatus: newStatus,
        lastReviewedAt: new Date(),
      })
      .where(eq(vocabItems.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
