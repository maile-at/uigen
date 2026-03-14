# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server (Turbopack) at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest tests
npm run db:reset     # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

## Architecture

**UIGen** is an AI-powered React component generator. Users describe a component in a chat interface, Claude generates the code, and it renders in a live preview — all without writing files to disk.

### Core Data Flow

1. User sends prompt → `POST /api/chat` with current virtual file system state
2. Server calls Claude (Haiku 4.5 via `@ai-sdk/anthropic`) with tool support
3. Claude uses `str_replace_editor` (create/edit files) and `file_manager` (rename/delete) tools
4. Tool calls stream back to client; `FileSystemContext` processes them to update in-memory file state
5. Preview iframe re-renders via Babel Standalone (browser-side JSX→JS transformation)
6. On stream finish, project state is saved to SQLite via Prisma (authenticated users only)

If `ANTHROPIC_API_KEY` is absent, a mock provider in `src/lib/provider.ts` is used instead.

### Key Abstractions

- **Virtual File System** (`src/lib/file-system.ts`, `src/lib/contexts/FileSystem.tsx`): In-memory tree of files/directories. No disk I/O. Serialized to JSON for database persistence.
- **AI Tools** (`src/lib/tools/`): Zod-schema-defined tools passed to the AI SDK. Tool results are processed client-side by `FileSystemContext`.
- **Preview** (`src/components/preview/`, `src/lib/transform/`): Renders the virtual FS in an iframe. Babel Standalone transforms JSX; an import map resolves virtual module paths.
- **Auth** (`src/lib/auth.ts`, `src/actions/`, `src/middleware.ts`): JWT cookies via `jose`, passwords hashed with `bcrypt`. Middleware protects `/api/*` routes.

### State Management

- `FileSystemContext` — owns all file state and processes AI tool calls
- `ChatContext` — wraps Vercel AI SDK's `useChat` hook
- Prisma + SQLite for persistence (schema: `prisma/schema.prisma`)

### Layout

Resizable two-panel layout: chat on the left, tabbed preview/code editor on the right. Monaco Editor handles code editing; shadcn/ui (new-york style) provides UI primitives.

### Coding Conventions

- Use comments sparingly. Only comment complex/non-obvious logic — not self-evident code.

### Path Alias

`@/*` maps to `./src/*`.

### Auth System

JWT sessions via `jose`, stored as httpOnly cookies (`auth-token`, 7-day expiry). Two verify paths:
- `getSession()` (`src/lib/auth.ts`) — server components, uses Next.js `cookies()`
- `verifySession(request)` (`src/lib/auth.ts`) — middleware, uses `NextRequest.cookies`

Post sign-in flow (`src/hooks/use-auth.ts`): save anonymous work → redirect to it, or redirect to most recent project, or create a new blank project. Anonymous work is tracked in `src/lib/anon-work-tracker.ts`.

UI: `src/components/auth/AuthDialog.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`.

### Database Schema

Schema at `prisma/schema.prisma`. SQLite (`prisma/dev.db`). Prisma client output: `src/generated/prisma`.

**User**: `id` (cuid), `email` (unique), `password` (hashed), timestamps, `projects[]`

**Project**: `id` (cuid), `name`, `userId?` (nullable — anonymous projects have no owner), `messages` (JSON string, chat history), `data` (JSON string, serialized virtual file system), timestamps. `onDelete: Cascade` from User.

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY` for real AI responses. The app works without it using the mock provider.
