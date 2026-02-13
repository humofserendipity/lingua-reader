# LinguaReader

## Overview
LinguaReader is a language learning EPUB reader web app. Users upload EPUB books in Spanish, read them with a clean paginated reader, highlight text to get AI-powered translations and grammar analysis, save vocabulary, and review with flashcards.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui components, wouter for routing, TanStack React Query
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Anthropic Claude via Replit AI Integrations (claude-sonnet-4-5 for analysis, claude-haiku-4-5 for vocab saving)
- **Auth**: Replit Auth (OpenID Connect)
- **EPUB**: epubjs for client-side rendering, multer for server-side file upload

## Project Structure
- `client/src/pages/` - Landing, Home, Reader, Flashcards pages
- `client/src/components/` - EpubReader, FloatingToolbar, AIPanel, BookUpload, ThemeToggle
- `client/src/lib/` - ThemeProvider, queryClient, auth-utils
- `client/src/hooks/` - useAuth, useToast
- `server/routes.ts` - All API endpoints (books, AI, vocab)
- `server/storage.ts` - DatabaseStorage with CRUD operations
- `server/db.ts` - Drizzle ORM database connection
- `server/replit_integrations/` - Auth and AI integration modules
- `shared/schema.ts` - Drizzle schemas for books, vocabItems (re-exports auth models)
- `shared/models/` - Auth and chat models

## Key Features
1. EPUB reader with paginated view, font size control, dark/light mode
2. Text selection → floating toolbar with Translate, Quick Grammar, Deep Grammar, Save Word, Save Sentence
3. AI panel showing streaming responses from Claude
4. Vocabulary list with word/sentence tracking
5. Flashcard review with Got It / Still Learning tracking
6. Reading position persistence
7. User authentication via Replit Auth

## API Routes
- `POST /api/books/upload` - Upload EPUB file
- `GET /api/books` - List user's books
- `GET /api/books/:id` - Get book details
- `GET /api/books/:id/file` - Serve EPUB file
- `PATCH /api/books/:id` - Update reading position
- `DELETE /api/books/:id` - Delete book
- `POST /api/ai/analyze` - Stream AI analysis (translate, quick-grammar, deep-grammar)
- `POST /api/ai/save-vocab` - Save word/sentence with AI enrichment
- `GET /api/vocab` - List user's vocabulary
- `DELETE /api/vocab/:id` - Delete vocab item
- `POST /api/vocab/:id/review` - Update flashcard review status

## Database Tables
- `users` - Replit Auth users
- `sessions` - Session storage
- `books` - User uploaded books with reading progress
- `vocab_items` - Saved words/sentences with translations and review status

## Running
- `npm run dev` - Start dev server on port 5000
- `npm run db:push` - Push schema changes to database
