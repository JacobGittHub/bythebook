<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — ByTheBook

ByTheBook is a chess opening trainer. Users build opening repertoires ("books"), explore
master-game statistics, and drill their lines. It is a solo project built for a handful of
users, and it is designed to handle about 50 without changes.

**Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind v4, Supabase (Postgres +
Auth via `@supabase/ssr`), deployed on Vercel. The stack also uses `chess.js` for rules,
`react-chessboard` for the board, and Stockfish (WASM) running in the browser.

**Product goal: memorability.** The app presents opening theory as explorable space. A user
should come away thinking of the Najdorf as a *place* with neighbors, not a move list they
once read. When a choice trades spatial memorability for technical elegance, memorability
wins.

**Status:** The Opening Explorer, repertoire management and the dashboard overview tree are
live. The trainer and puzzle pages are placeholder scaffolding. The long-term direction is
not settled. The territory map and hyperbolic panel are the leading candidates for the next
visualizations, but don't start building them, or shape other work around them, unless the
user asks. The shared vision and current work are in `plans/`.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Typecheck | `npx tsc --noEmit` (passes; keep it passing) |
| Lint | `npm run lint` (13 pre-existing React hooks errors remain; don't add new ones) |
| Tests | `npm test` (Vitest, runs `src/**/*.test.ts`); `npm run test:watch` while working |
| Production build | `npm run build` |
| Rebuild the opening catalog | `npm run catalog:download`, then `npm run catalog:index` |
| Fill `position_cache` for the catalog | `npm run cache:prefill` (calls Lichess for hours; the user runs it, agents use `-- --dry-run`) |
| Make beta invite or reset codes | `npm run invites:create` (writes to the live database; the user runs it) |
| Regenerate DB types | `npm run db:types` (see "Database changes" below) |

To check a change, run the typecheck, the tests, and lint on the files you touched. For UI
changes, also run the app and look at the result. Tests sit next to the code they test as
`*.test.ts`; they run in Node, so keep tested code free of browser APIs.

## Environment

- The machine runs Windows 11. Agents have Git Bash and Windows PowerShell 5.1. PowerShell
  5.1's `>` writes UTF-16, so use Git Bash (or `Out-File -Encoding utf8`) whenever you
  redirect output into a file the project reads.
- Next.js 16 renamed middleware to proxy. Route protection lives in `src/proxy.ts`, which must
  export a function named `proxy`. All `/dashboard/*` routes require auth.
- The React Compiler is not enabled. Don't use it.
- `.env.local` (never commit it) holds `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `LICHESS_API_TOKEN`, and optionally
  `NEXT_PUBLIC_BETA_CONTACT_EMAIL` (the address behind the landing page's beta key link). Only
  `NEXT_PUBLIC_*` values may reach client code.

## Where things live

- `src/app/` holds routes, and `src/app/api/` holds route handlers.
- `src/components/` is organized by feature: `board/`, `openings/`, `repertoire/`,
  `training/`, `puzzles/`, `lab/`.
- `src/lib/chess/` holds chess logic and the opening catalog. `src/lib/db/` holds all
  Supabase access. `src/lib/validators/schemas.ts` holds the Zod schemas.
- `scripts/` holds the catalog build scripts and the cache pre-fill script, and
  `supabase/migrations/` holds migrations.

## How to work

- **Plan first for anything non-trivial.** Use plan mode and settle design questions in
  writing before implementing. This project stalled once from trying to converge on an
  unstated vision through iterative prompting. Multi-step work is tracked in `plans/` (see
  "Plans" below).
- **Don't let estimated effort pick the solution.** Implementation time is cheap here; a
  tangled workaround is not. When the proper fix is to install the right dependency, write
  the missing module, or change the data model, do that. Don't bend an existing dependency
  to fit or add a shim around the gap. You will often overestimate how hard the full
  solution is. If it really is large, propose it in plan mode instead of quietly shrinking
  it. This applies to the task at hand: it doesn't widen the scope, and it doesn't override
  the git or deletion rules below.
- **Specify visualization work by invariants, not appearance.** "Sibling regions are
  disjoint, every child region lies inside its parent, and output is byte-identical on
  identical input" can be tested; "make it look good" can't. Layout functions are pure,
  of the form `layout(tree, weightMode) → Map<NodeId, Geometry>`, and ship with property
  tests of their invariants.
- **Git is read-only for agents.** `status`, `diff`, `log` and `show` are fine. The user
  makes all commits. Mutating git commands are blocked in `.claude/settings.local.json`.
- **Don't delete what's kept on purpose** (see the list below). Being unused is not a reason
  to remove something. Removing anything on that list, or any agent doc, needs the user's
  explicit say-so. When something becomes superseded, add it to the list rather than
  deleting it.
- **Keep the docs true.** When you change code that a `docs/` doc describes, update that
  doc in the same change and bump its "Last reviewed" date. Don't copy values that live in
  code (constants, line counts, file lists) into docs; name the constant instead. Only
  create new docs when the user asks.
- The harness memory is for how the user likes to work. Architecture decisions go in this
  file or in `docs/`.

## Plans

`plans/` holds the shared vision and one file per piece of work. The user and agents both
edit these files.

- Start with `plans/README.md`, which has the index, the current focus and the file format.
  Then read only the plan you're working on and the plans it depends on.
- Lines starting with `> ME:` are the user's notes. A question stays open until the user
  answers it; your recommendation doesn't settle it.
- A plan's Decisions are binding. To change one, raise it with the user first.
- When you edit a plan, update its `Updated` date and its row in the index. Create a new plan
  only when the user asks.

## Project rules

**Data and APIs**

- Never call `explorer.lichess.ovh` from client code. All Lichess calls go through
  `/api/openings/explorer`, which caches results in `position_cache`. The route serves
  guests from the cache only; a guest's request must never reach Lichess. The one other
  caller is the local `npm run cache:prefill` script, which uses the same library code.
- Every route handler counts its call with `recordUsage` (`src/lib/db/usage.ts`), after the
  auth check.
- Stockfish runs only in the browser (`src/hooks/useEngine.ts`). Never run engine analysis
  or drill generation in Vercel functions. Those functions do single-row reads and writes;
  anything that walks trees or aggregates runs client-side.
- Books are `MoveNode` trees stored in `opening_books.move_node` (JSONB). Don't store moves
  as relational rows, don't build global `positions` or `edges` tables, and don't move
  `openingCatalogIndex.json` into Supabase.
- Opening trees are true trees keyed by move sequence, and transpositions duplicate subtrees
  on purpose. Don't re-key them by position hash or turn them into a DAG.
- Sort sibling moves deterministically: by count descending, then by UCI string ascending.
  Without the tiebreak, layouts shift between runs.
- Validate API input with Zod. Route handlers validate, call `src/lib/` functions and return;
  keep business logic out of them. Client components never call the database directly.
- Use FEN strings to identify positions. `toPositionKey()` (`src/lib/chess/fen.ts`) drops
  the clock fields and is the key for per-position stats and for `position_cache`. Use UCI
  internally and convert to SAN only in the UI.

**Generated files (never hand-edit)**

- `src/types/database.ts`, which the Supabase CLI generates.
- `src/lib/chess/generated/openingCatalogIndex.json`, which `npm run catalog:index`
  generates.

**Database changes**

1. Write `supabase/migrations/<timestamp>_<name>.sql` containing only the change. Never
   change the schema any other way.
2. Ask the user to run it in the Supabase SQL editor.
3. Regenerate the types with `npm run db:types`. Don't run the underlying `supabase gen types`
   command with PowerShell 5.1's `>`, which writes UTF-16 and breaks lint.

**UI**

- A page with a main interactive board (explorer, trainer, puzzles) must fit the viewport.
  The page body never scrolls, the board scales to fit (`size="full"`), and only side panels
  scroll internally.
- `BoardBase` is the only component that wraps `react-chessboard`. `BoardDisplay` (static)
  and `BoardInteractive` (playable, through `useChessGame`) wrap `BoardBase`. Feature pages
  compose those two and never define their own board components.
- Use Server Components by default, and add `'use client'` only when hooks or browser APIs
  require it. Don't use `any`.

## Kept on purpose

These look removable but are retained deliberately. Don't delete them, or propose removing
them, unless the user brings it up.

| Item | Why it stays | Removable when |
|---|---|---|
| `src/components/repertoire/OpeningTreeFull.tsx` | It is the live dashboard overview | A successor ships and the user says so |
| `src/components/openings/OpeningMiniTree.tsx` | It is the live explorer sidebar tree, and the user wants it kept as-is | A successor ships and the user says so |
| `d3`, `@types/d3` | `OpeningTreeFull` uses them | `OpeningTreeFull` is removed |
| `src/components/lab/GlobeTest.tsx`, `src/components/lab/ChessMap.tsx` | They are prototypes the user may revisit | The user says so |
| `three`, `@react-three/fiber`, `@react-three/drei` | `GlobeTest` uses them | The user says so |
| `@xyflow/react`, `framer-motion` | They are unused, but kept for possible lab work | The user says so |

## Read before working on…

These docs live in `docs/`, which is version controlled and public like this file, so
keep secrets out of both. They aren't loaded automatically, so read the relevant one before
you start.

| When you're working on… | Read |
|---|---|
| The data model, catalog, database, caching, engine, dependencies, or any "why is it like this" question | `docs/architecture.md` |
| The Lichess API route or `position_cache` | `docs/processes/lichess-api-and-caching.md` |
| Any tree or map visualization | `docs/architecture.md` § "Visualization principles", then the design doc below |
| The Opening Explorer or the mini tree | `docs/design/explorer.md` |
| The dashboard overview tree | `docs/design/dashboard-overview.md` |
| The territory map (candidate) | `docs/design/territory-map.md` |
| The hyperbolic panel (candidate) | `docs/design/hyperbolic-panel.md` |
| The lab page, globe, ChessMap, or branch view | `docs/design/lab-prototypes.md` |
| The lab "Regions" tab (region map) or `src/lib/regions/` | `docs/design/region-map.md` |
