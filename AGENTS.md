<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — ByTheBook

ByTheBook is a chess opening trainer. Users build opening repertoires ("books"), explore
master-game statistics, and drill their lines. It is a solo project for guests and about 100
beta testers (`plans/vision.md`).

**Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind v4, Supabase (Postgres +
Auth via `@supabase/ssr`), deployed on Vercel. The stack also uses `chess.js` for rules,
`react-chessboard` for the board, and Stockfish (WASM) running in the browser.

**Product goal: memorability.** The app presents opening theory as explorable space. A user
should come away thinking of the Najdorf as a *place* with neighbors, not a move list they
once read. When a choice trades spatial memorability for technical elegance, memorability
wins.

**Status:** The Opening Explorer, the Library (a book list and a page per book), the
Bookstore, the Treemap opening tree, the five book views (small visualizations, also in the
Explorer's tree window) and the Overview page are live, and guests can use all of them
without an account. Until the Bookstore has its back end (`plans/bookstore.md`), its books
are the example books. The Labyrinth, the region map prototype, is the visualization in
active development (`plans/region-map.md`), and it is also the first test of the territory
map's ideas. The territory map and the hyperbolic panel remain candidate designs; don't
build them, or shape other work around them, unless the user asks. The trainer and puzzle
pages are placeholders. The shared vision and current work are in `plans/`.

**Names:** the **Treemap** is the live radial opening tree, which was called the Atlas until
2026-10-02. The **Labyrinth** is the region map prototype, laid out live from explorer data.
The **Atlas** now means the planned static, pre-generated region map (`plans/atlas.md`),
which is not in development.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev`; `npm run dev:stop` stops every dev server and watcher on the machine (`-- -List` only lists them) |
| Typecheck | `npx tsc --noEmit` (passes; keep it passing) |
| Lint | `npm run lint` (reports no problems; keep it that way, since CI fails on any) |
| Tests while working | `npm run test:changed` (tests affected by uncommitted changes), or `npm run test:related -- <files>` |
| All tests | `npm run test:agent` (one line per failure, stops at the first); `npm test` for the full report |
| Browser tests | `npm run test:e2e` (Playwright, all browsers; starts the dev server or uses a running one), `npm run test:e2e:clean` (deletes run output) |
| Screenshot tests | `npm run test:screens`, `npm run test:screens:update` (new baselines), `npm run screens:flush` (list or delete them) |
| Agent docs | `npm run docs:check` (`docs/docs.test.ts` alone; `npm test` includes it), `npm run docs:sizes` (token estimates) |
| Production build | `npm run build` |
| Rebuild the opening catalog | `npm run catalog:download`, then `npm run catalog:index` |
| Rebuild the example books | `npm run books:examples` (reads Wikibooks, the catalog and `position_cache`, never Lichess; `-- --skip-masters` keeps the books made from the cache) |
| Fill `position_cache` for the catalog | `npm run cache:prefill` (calls Lichess for hours; the user runs it, agents use `-- --dry-run`) |
| Make beta invite or reset codes | `npm run invites:create` (writes to the live database; the user runs it) |
| Regenerate DB types | `npm run db:types` (see "Database changes" below) |

To check a change, run the typecheck, `npm run test:agent`, and lint on the files you
touched. For UI changes, also run `npm run test:e2e` and look at the result. Tests sit next to
what they test as `*.test.ts` and run in Node, so keep tested code free of browser APIs.
Vitest is for code that runs without a browser; browser tests are Playwright's, in `e2e/`
(`docs/architecture.md` § "Browser tests"). CI runs both on every push.

**When the user pastes a bug report** (the debug-mode button's text), open its Reproduce
address, or its page at its window size, in Playwright, and screenshot it before and after the
fix. Keep a visual bug as a screenshot spec in `e2e/screens/bugs/`.

**Clean up after browser tests.** Run output only goes to `test-results/` and
`playwright-report/`, and baselines only to `e2e/screens/`. After a session that ran
Playwright, run `npm run test:e2e:clean`. Before ending a run, stop any dev server you
started with `npm run dev:stop` (Playwright stops the one it starts itself); stopping its
shell can leave the server running. When a session touched screenshots, run
`npm run screens:flush` to list them, and offer to delete any whose bug or view is finished.

## Environment

- The machine runs Windows 11. Agents have Git Bash and Windows PowerShell 5.1. PowerShell
  5.1's `>` writes UTF-16, so use Git Bash (or `Out-File -Encoding utf8`) whenever you
  redirect output into a file the project reads.
- Next.js 16 renamed middleware to proxy. Route protection lives in `src/proxy.ts`, which must
  export a function named `proxy`. Guests may open every `/dashboard/*` page except the ones
  `src/lib/auth/access.ts` marks as needing an account.
- The React Compiler is not enabled. Don't use it.
- `.env.local` (never commit it) holds `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `LICHESS_API_TOKEN`, and optionally
  `NEXT_PUBLIC_BETA_CONTACT_EMAIL` (the address behind the beta key and reset code links),
  `DEBUG_MODE` and `DEBUG_EMAILS` (debug mode, `docs/design/dashboard.md`), `E2E_EMAIL` and
  `E2E_PASSWORD` (the browser tests' account), and `PUBLISHER_EMAIL` and `PUBLISHER_PASSWORD`
  (the account that publishes the Bookstore's books, for the planned publishing script in
  `plans/bookstore.md`). Agents never
  read the file; scripts load it. Only `NEXT_PUBLIC_*` values may reach client code.

## Where things live

- `src/app/` holds routes, and `src/app/api/` holds route handlers.
- `src/components/` is organized by feature: `board/`, `openings/`, `repertoire/`,
  `books/` (the book views), `library/` (the Library and Bookstore pages), `training/`,
  `puzzles/`, `overview/`, `layout/` (the dashboard frame), `lab/` (the visualization
  prototypes). `shadcn/` holds shadcn/ui's components, added with `npx shadcn@latest add`
  and owned from then on (`docs/architecture.md` § "Dependencies").
- `src/lib/chess/` holds chess logic and the opening catalog. `src/lib/books/` holds what is
  worked out about books, the book views' layouts and the example books. `src/lib/library/`
  holds the library: validation, summaries, backups, the two stores and their write rules.
  `src/lib/db/` holds
  all Supabase access. `src/lib/validators/schemas.ts` holds the Zod schemas.
- `scripts/` holds the catalog build scripts, the cache pre-fill script and the example book
  builder, and `supabase/migrations/` holds migrations.

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
  tests of their invariants. A property test gathers its violations over every run and
  asserts once with `expectNoViolations` (`src/lib/regions/testShapes.ts`).
- **Git is read-only for agents.** `status`, `diff`, `log` and `show` are fine. The user
  makes all commits. Mutating git commands are blocked in `.claude/settings.local.json`.
- **Don't delete what's kept on purpose** (see the list below). Being unused is not a reason
  to remove something. Removing anything on that list, or any agent doc, needs the user's
  explicit say-so. When something becomes superseded, add it to the list rather than
  deleting it.
- **Keep the docs true.** When you change code that a `docs/` doc describes, update that
  doc in the same change. State each fact in one place and point to it from elsewhere, and
  name constants and files instead of copying their values. `docs/docs.test.ts` fails when
  a doc names a file, route, package or constant that doesn't exist, or a planned one that
  now does. Docs carry no review dates; git history shows when a doc changed. Only create
  new docs when the user asks.
- **When sources disagree:** the code is the truth about what the system does, so fix the
  doc. The plans are the truth about direction and the user's latest requirements, and they
  outrank `docs/` there. A plan that contradicts the code may be ahead of it rather than
  wrong.
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
- Save every mockup you publish as a standalone HTML file in `plans/mockups/`, named after the
  page it draws, with a comment at the top naming the plan it serves. When that work ships,
  move the file to `docs/design/mockups/` and point to it from the design doc.

## Project rules

**Data and APIs**

- Never call `explorer.lichess.ovh` from client code. All Lichess calls go through
  `/api/openings/explorer`, which caches results in `position_cache`. The route serves
  guests from the cache only; a guest's request must never reach Lichess. The one other
  caller is the local `npm run cache:prefill` script, which uses the same library code.
- Every route handler counts its call with `recordUsage` (`src/lib/db/usage.ts`), after the
  auth check.
- Stockfish runs only in the browser (`src/hooks/useEngine.ts`). Never run engine analysis
  or drill generation in Vercel functions. Those functions do single-row writes and reads by
  primary key, of one row or a capped batch (`plans/deployment.md` D1); anything that walks
  trees, scans or aggregates runs client-side.
- A book is a list of `MoveNode` trees stored in `opening_books.trees` (JSONB), with its
  summary in `opening_books.summary` (`src/lib/library/`). Don't store moves
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
  internally and convert to SAN only in the UI. The formats are compared in
  `docs/architecture.md` § "Position formats".

**Guests and accounts**

- A sidebar page is declared in `NAV_ITEMS`, and a visualization in `VISUALIZATIONS`, each
  with whether it needs an account (`src/lib/auth/access.ts`). The sidebar, the proxy, the
  Overview page and the Visualizations page read them; don't list pages anywhere else.
- A button that routes to a page says so in words, as `RouteCard`
  (`src/components/ui/RouteCard.tsx`) does with its "Jump to page" tag. Don't use an arrow
  for it.
- Every route handler except `/api/openings/explorer` returns 401 without a user.
- A component that reads or saves account data checks `useViewer()` (client) or
  `getViewer()` (server) first, so a guest causes no request that is bound to fail and sees
  `SignInPrompt` in place of the control. Books are not account data: pages read and save
  them through `useLibrary()` (`src/context/Library.tsx`), which keeps a guest's in the
  browser.

**Generated files (never hand-edit)**

- `src/types/database.ts`, which the Supabase CLI generates.
- `public/books/examples/`, which `npm run books:examples` writes.
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
  scroll internally. Such a page is `h-[calc(100dvh-var(--dash-offset))]` tall; the offset
  is set by `DashboardShell` (`src/components/layout/`), so don't hardcode one, and don't
  use `100vh`.
- Build new controls from shadcn/ui's components (`src/components/shadcn/`): Button, Dialog,
  AlertDialog, DropdownMenu, Select, ToggleGroup and the rest. Their colors are the theme
  tokens, so every background mode, and later every vibe (`plans/vibes.md`), restyles them.
  Such a control asks with an AlertDialog before anything that can't be undone and reports
  with a toast (`sonner`), not with `confirm()` or `alert()`. The other pages move over in
  `plans/vibes.md`'s first phase.
- Until then, color anything that is pressed outside shadcn/ui with `btn-primary`,
  `btn-secondary` or `btn-ghost` (`src/app/globals.css`), or with the theme variables. Fixed
  `slate-*` and `white` classes on a button make its text unreadable in some background
  modes, most often on hover.
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
| `src/components/repertoire/OpeningTreeFull.tsx` | It is the live opening tree on the Treemap page (under Visualizations) | A successor ships and the user says so |
| `src/components/openings/OpeningMiniTree.tsx` | It was the explorer sidebar tree until the book views replaced it on 2026-10-06, and the user wanted it kept as-is | The user says so |
| `d3`, `@types/d3` | `OpeningTreeFull` uses them | `OpeningTreeFull` is removed |
| `src/components/lab/GlobeTest.tsx`, `src/components/lab/ChessMap.tsx`, `src/components/lab/LabHarness.tsx` | They are prototypes the user may revisit, listed on the Visualizations page as possible future ones | The user says so |
| `three`, `@react-three/fiber`, `@react-three/drei` | `GlobeTest` uses them | The user says so |
| `@xyflow/react`, `framer-motion` | They are unused, but kept for possible prototype work | The user says so |

## Read before working on…

Docs aren't loaded automatically, so read the relevant one before you start. They are
public like this file, so keep secrets out of both.

| When you're working on… | Read |
|---|---|
| The data model, catalog, database, caching, engine, dependencies, or any "why is it like this" question | `docs/architecture.md` |
| The Lichess API route or `position_cache` | `docs/processes/lichess-api-and-caching.md` |
| Any tree or map visualization | `docs/architecture.md` § "Visualization principles", then the design doc below |
| The Opening Explorer, its tree window or the book views (small visualizations) | `docs/design/explorer.md` |
| The Treemap page's opening tree | `docs/design/opening-tree.md` |
| Guest and account access, or sign-in | `docs/architecture.md` § "Auth and API routes" |
| The dashboard frame, sidebar, Overview, Visualizations, Library or Bookstore page, or theme colors | `docs/design/dashboard.md` |
| The territory map (candidate) | `docs/design/territory-map.md` |
| The hyperbolic panel (candidate) | `docs/design/hyperbolic-panel.md` |
| The Visualizations page's prototypes: globe, ChessMap, or branch view | `docs/design/lab-prototypes.md` |
| The Labyrinth (the region map prototype) or `src/lib/regions/` | `docs/design/region-map.md` |
| The agent docs, plans or the docs test, or their context cost | `docs/README.md`, then `docs/agent-context-map.md` |
