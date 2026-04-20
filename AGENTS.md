<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md - Chess Trainer Project

This file provides context, architecture decisions, and coding guidelines for AI coding agents working on this project. Read this fully before making any changes.

---

## Project Overview

A chess opening training web application built for a small number of users (2-3 concurrent max). The goal is not to play chess games against others, but to train and test opening knowledge against an opening book database. Users authenticate, select or build opening repertoires (playbooks), and drill against the app which throws sidelines and tests depth using master-game data.

Planned features (in rough priority order):
1. Opening training against a user-defined or suggested opening book
2. Repertoire/playbook management (supporting lines for both colors)
3. Puzzle trainer (free, unlimited)
4. Position concept questions ("what are the main ideas here?") - future/experimental
5. Optional 3D board perspective mode - future

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth with `@supabase/ssr` |
| Database | Supabase (Postgres) |
| ORM | None currently - raw Supabase JS client. Prisma may be introduced later. |
| Chess logic | `chess.js` |
| Chess board UI | `react-chessboard` |
| Chess engine | `stockfish` (npm) - WASM, runs client-side in a Web Worker |
| Opening data | Lichess Opening Explorer API (`explorer.lichess.ovh`) - proxied through API routes |
| Puzzle data | Lichess puzzle database dump (imported into Supabase) |
| Deployment | Vercel |

---

## Repository Structure

```txt
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── train/
│   │   │   ├── page.tsx
│   │   │   └── [bookId]/page.tsx
│   │   ├── repertoire/page.tsx
│   │   ├── puzzles/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── openings/
│       │   ├── explorer/route.ts
│       │   └── books/route.ts
│       ├── training/
│       │   └── sessions/route.ts
│       ├── puzzles/route.ts
│       └── user/route.ts
├── components/
│   ├── ui/
│   ├── board/
│   ├── training/
│   ├── repertoire/
│   └── puzzles/
├── lib/
│   ├── supabase.ts
│   ├── db/
│   │   ├── users.ts
│   │   ├── openings.ts
│   │   ├── sessions.ts
│   │   ├── puzzles.ts
│   │   └── positionCache.ts
│   ├── chess/
│   │   ├── lichessExplorer.ts
│   │   ├── openingNames.ts
│   │   └── fen.ts
│   └── validators/
│       └── schemas.ts
├── hooks/
├── types/
│   ├── database.ts
│   ├── chess.ts
│   ├── training.ts
│   └── user.ts
├── proxy.ts
└── workers/
    └── stockfish.worker.ts
```

---

## Database Schema

The database is hosted on Supabase (Postgres). All tables have Row Level Security (RLS) enabled.

### Tables

`profiles` - extends `auth.users`, stores display info

```sql
id uuid (PK, FK -> auth.users)
username text (unique)
created_at timestamptz
updated_at timestamptz
```

`opening_books` - user repertoires/playbooks

```sql
id uuid (PK)
user_id uuid (FK -> profiles)
name text
color text ('white' | 'black')
moves jsonb
is_public boolean
created_at timestamptz
updated_at timestamptz
```

`training_sessions` - results of each training drill

```sql
id uuid (PK)
user_id uuid (FK -> profiles)
book_id uuid (FK -> opening_books, nullable)
result text ('pass' | 'fail' | 'abandoned')
moves_played jsonb
correct_moves int
total_moves int
duration_seconds int
created_at timestamptz
```

`position_cache` - cached Lichess Opening Explorer API responses

```sql
fen text (PK)
explorer_data jsonb
cached_at timestamptz
```

`puzzles` - imported from Lichess puzzle database dump

```sql
id text (PK)
fen text
moves text[]
rating int
themes text[]
popularity int
```

`puzzle_history` - per-user puzzle attempt tracking

```sql
id uuid (PK)
user_id uuid (FK -> profiles)
puzzle_id text (FK -> puzzles)
solved boolean
time_seconds int
attempted_at timestamptz
UNIQUE(user_id, puzzle_id)
```

### RLS Policies Summary

- `profiles`: users read/write their own row only
- `opening_books`: users manage their own; all authenticated users can read public books
- `training_sessions`: private to each user
- `puzzle_history`: private to each user
- `position_cache`: readable by all authenticated users, written only by server (service role)
- `puzzles`: readable by all authenticated users

---

## Schema Migration Workflow

Never change the database schema in the Supabase UI without also recording it as a migration file.

Migration files live in `supabase/migrations/` and are named with a timestamp prefix.

When making a schema change:
1. Write a new `.sql` file in `supabase/migrations/` describing only the change.
2. Run it in the Supabase SQL Editor.
3. Regenerate TypeScript types:
   ```bash
   npx supabase gen types typescript --project-id alyrmmmaxbcxgbphjcag > src/types/database.ts
   ```
4. Commit both the migration file and the updated `src/types/database.ts`.

`src/types/database.ts` is auto-generated. Do not hand-edit this file.

Until Prisma is introduced, all DB access goes through the Supabase JS client in `src/lib/db/`.

---

## Key Architectural Decisions

### Stockfish runs client-side, not server-side

The chess engine runs entirely in the browser via a Web Worker.

- Zero server compute cost for analysis
- No queue system needed
- `src/workers/stockfish.worker.ts` manages worker communication
- `useEngine` provides the UI-facing hook
- Vercel must serve the app with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers for multithreaded engine support

### Lichess Opening Explorer is proxied

All calls to `explorer.lichess.ovh` go through `src/app/api/openings/explorer/route.ts`.

That route:
1. Checks `position_cache` first
2. Calls Lichess on cache miss
3. Stores the result in `position_cache`
4. Backs off on HTTP 429

Never call the Lichess API directly from client components.

### Opening books are stored as JSONB trees

Opening repertoires are stored in the `moves` JSONB column on `opening_books`, not as relational move rows.

### Auth pattern

Supabase Auth with `@supabase/ssr`.

- `src/lib/supabase.ts` exports the browser and server auth clients
- Sign in and sign up use `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`
- Route protection is handled in `src/proxy.ts`
- The currently logged-in user is resolved server-side with `supabase.auth.getUser()`
- All `/dashboard/*` routes require authentication

### API route pattern

```txt
Client component
  -> fetch('/api/openings/explorer', { method: 'POST', body: { fen } })
  -> src/app/api/openings/explorer/route.ts
  -> src/lib/db/positionCache.ts
  -> src/lib/chess/lichessExplorer.ts (if cache miss)
  -> returns data to client
```

Keep business logic out of route handlers. Route handlers should validate input with Zod, call lib functions, and return responses.

---

## Environment Variables

Required in `.env.local` (never commit this file):

```txt
NEXT_PUBLIC_SUPABASE_URL=https://bcpkifxnjfjzfrqvpkby.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`NEXT_PUBLIC_` prefixed variables are safe to use in client components. Variables without this prefix are server-only and must never be referenced in client components or passed to the browser.

---

## Coding Conventions

- TypeScript strict mode - no `any`
- Zod for all API input validation - schemas live in `src/lib/validators/schemas.ts`
- No direct DB calls from client components
- FEN strings are the universal position identifier
- UCI format for engine moves; convert to SAN only at the UI layer
- Tailwind v4 for styling
- Server Components by default; only add `'use client'` when browser APIs or hooks are required

---

## External APIs

### Lichess Opening Explorer

- Base URL: `https://explorer.lichess.ovh`
- Master games endpoint: `GET /master?fen=<FEN>&moves=<N>`
- Back off on HTTP 429
- Always proxy through `/api/openings/explorer`

### Lichess Opening Names

- Static dataset from `https://github.com/lichess-org/chess-openings`
- Bundle as local project data rather than fetching at runtime

### Lichess Puzzle Database

- Downloaded from `https://database.lichess.org/#puzzles`
- Imported as CSV into `puzzles`
- No runtime puzzle API calls

---

## What Not to Do

- Do not run Stockfish on the server
- Do not call `explorer.lichess.ovh` directly from client components
- Do not hand-edit `src/types/database.ts`
- Do not change the Supabase schema without writing a migration file
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Do not store opening tree moves as relational rows
- Do not use the React Compiler - it is not enabled in this project
<!-- END:nextjs-agent-rules -->
