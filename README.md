# ByTheBook

A chess opening trainer built around memorability: it presents opening theory as places to
explore, so an opening is remembered as a region with neighbors rather than a list of moves.
Users build opening repertoires ("books"), explore master-game statistics, and, in the
Labyrinth, zoom through a map where every move is a region inside the move before it.

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Postgres and Auth),
Vercel. Stockfish runs in the browser as WebAssembly, and master-game statistics come from
the Lichess Opening Explorer through a cached server route.

## Running it

```bash
npm install
npm run dev
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `LICHESS_API_TOKEN`.

| Check | Command |
|---|---|
| Types | `npx tsc --noEmit` |
| Tests (Vitest) | `npm test` |
| Lint | `npm run lint` |

## How the project is organized

The project is built primaritly with AI coding agents, and its working documents are part of the
repository:

- [`AGENTS.md`](AGENTS.md): the rules and map every agent session starts from.
- [`docs/`](docs/): how the system works and why. A test (`docs/docs.test.ts`) checks that
  every file, route and constant the docs name still exists.
- [`plans/`](plans/): the vision and the work in progress, written by agents and annotated by
  the developer.
