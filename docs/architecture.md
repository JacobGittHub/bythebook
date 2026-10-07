# Architecture

This file explains why the system is built the way it is. The rules themselves are in
`AGENTS.md`; this file holds the reasoning and detail behind them. When the code can answer
a question, the code is the source of truth. This file covers what the code can't tell you.

**Contents:** Opening tree data model · Position formats · Weight modes · Visualization
principles · Opening catalog · Storage and database · Compute strategy · Engine · External data sources ·
Auth and API routes · Stored vs computed · Dependencies · Known issues and scaling ·
Rejected alternatives

---

## Opening tree data model

```ts
type MoveNode = {
  id: string;          // stable; see createMoveNodeId() in src/lib/chess/moveTree.ts
  san: string | null;  // null at the root
  uci: string | null;  // null at the root
  fen: string;
  children: MoveNode[];
};
```

- **Books are nested trees, not flat lists of lines.** The trainer's side panel is meant to
  host a clickable node-link tree for choosing the active line. Each node therefore needs its
  own identity so it can be shown as selected or faded. A book's root is its starting
  position.
- **The tree is keyed by move sequence, not by position.** As a result, transpositions
  duplicate subtrees, and that is deliberate. A DAG can't be drawn without either edge
  crossings or losing region containment, and both candidate visualizations depend on
  containment. If transposition awareness is wanted later, add it as an annotation layer
  ("this position also arises via…") without changing the keying.
- **What a book's card says about it** is worked out by `src/lib/books/measures.ts` from a
  list of trees: positions against the limit, the unconnected-lines flag, leaf depths,
  clashes, and coverage of master games. A book is still one tree today; the list is the
  shape `plans/bookstore.md` (D16) moves books to. The small visualization pages show the
  first four; coverage needs master numbers and is called only by tests so far.
- **Stats are transposition-aware anyway.** `user_position_stats` is keyed by
  `toPositionKey(fen)`, which is the FEN without the clock fields. The same position reached
  by different move orders therefore aggregates into one row.
- **Children are ordered deterministically:** by count descending, then by UCI string
  ascending. The tiebreak matters. Without it, equal-count siblings can swap order between
  runs, and every layout built on the tree shifts.
  - **Known gap:** `buildDefaultCatalogTree()` sorts only by ECO-coverage count, so ties fall
    back to `Map` insertion order. That is stable only for a fixed index file. Add the UCI
    tiebreak when the planned shared tree module (`src/lib/chess/openingTree.ts`) is built.

## Position formats

| Format | Example | What it holds | Used here for |
|---|---|---|---|
| FEN | `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1` | One position: the pieces, side to move, castling rights, en passant square, and two clocks (moves since a capture or pawn move, and the move number) | Drawing boards, and asking Lichess about a position |
| Position key | The FEN without its two clocks (`toPositionKey()`) | The same position, whatever move order reached it | Keys for `position_cache`, per-position stats and the catalog's `byPositionKey` |
| UCI | `e2e4`, `e7e8q` | One move as from-square, to-square and promotion | Identifying moves: tree keys, region map blob ids, the catalog's `byUciPrefix` |
| SAN | `e4`, `Nf3`, `exd5` | One move as people write it; it can only be read against the position before it | Display only |
| PGN | `1. e4 e5 2. Nf3` | A game or line in SAN with move numbers | The catalog's source (`ecoData.json`), and game import later |

- **A FEN can be worked out from the line that reaches it,** but only by replaying the moves
  with chess.js, at about 0.15 ms a move. Storing FENs trades size for that time: the catalog
  index stores one per move of every opening, which is most of its size (`plans/data-delivery.md`).
- **Two lines can reach one position** (a transposition): two UCI lines, one position key.
  That is why trees are keyed by line and stats by position key (see above).
- **SAN needs the position to be read** (`Nf3` doesn't say which knight), so it is never a key.

## Weight modes

Visualizations size nodes by a weight. There are three modes, and the user chooses between
them:

1. **`games`: game frequency.** It uses the local ECO catalog, supplemented by Lichess
   explorer data for positions outside it. **As a shared mode it is unbuilt:** the catalog
   index holds no game counts, so they would come from `position_cache` once pre-filled.
   The Labyrinth already sizes its regions this way, from each position's explorer data as
   it loads (`design/region-map.md`).
2. **`engine`: a softmax over centipawn loss relative to the best move,**
   `w_i = exp(-loss_i / λ)`, with λ exposed as a tunable sharpness parameter. It needs
   `position_evals`, which no code writes to yet.
3. **`subtree`: the subtree node count.** This is the permanent fallback when there is no
   data. It is a real mode, not a stand-in, and it is what `GlobeTest` and `ChessMap`
   implement today.

Switching modes changes areas only; the tree topology stays the same. The planned shared
module for this is `src/lib/chess/weights.ts`.

## Visualization principles

These apply to the candidate production visualizations (the territory map and the hyperbolic
panel). The lab prototypes are exempt; see `design/lab-prototypes.md`.

**The containment invariant.** Every child's region lies entirely inside its parent's
region, and sibling regions never overlap. That single constraint delivers three properties:

1. **Borders or edges can never cross.** Containment enforces this geometrically.
2. **The layout is deterministic.** Given the same tree and weight mode, the output geometry
   is byte-identical across runs and machines.
3. **Expanding a node doesn't move anything already on screen.** This is the property that
   matters most, because it makes a visualization feel like a *map* rather than a graph
   rearranging itself under the user.
   - In the territory map, zooming into a node keeps its parent and siblings visible at a
     smaller scale, and nothing outside the node's region moves.
   - In the hyperbolic panel, focusing a node pulls its subtree toward the center while
     ancestors and abandoned lines compress smoothly toward the rim.

**Containment is topological.** Pie-style angular wedges are its least interesting
realization. Organic Voronoi polygons and hyperbolic arcs satisfy it just as well, and they
read as territory rather than as a chart. An earlier round of work treated containment as a
mandate for wedges; that reading is rejected.

**Engine-derived nodes must be visually distinguishable from game-derived nodes at every
zoom level**, so that the user always knows when they have left recorded theory.

**Visualizations share the data layer and nothing else.** They differ in data, layout,
interaction and scale, so no two of them share rendering code.

## Opening catalog

The catalog is local and pre-generated. No runtime parsing or API calls are needed to name
an opening.

- **Build pipeline.**
  - `npm run catalog:download` (`scripts/buildCatalog.mjs`) fetches ECO volumes A–E from
    `github.com/lichess-org/chess-openings` into `src/lib/chess/ecoData.json`.
  - `npm run catalog:index` (`scripts/buildOpeningCatalogIndex.mjs`) replays every PGN with
    chess.js and writes `src/lib/chess/generated/openingCatalogIndex.json` (v2).
  - Both outputs are committed, so the app never generates them at runtime.
- **Index format.** The index holds about 3,800 openings, each with `eco`, `name`, `pgn`,
  `moves` and per-move FENs. It carries **no game counts**. Three indexes give O(1) lookup:
  `byEco`, `byUciPrefix` (a space-joined UCI line) and `byPositionKey` (transposition-aware).
- **API.** The public API is the exports of `src/lib/chess/openingCatalog.ts`:
  `searchCatalogMatches`, `getCatalogMatchesForUciLine`, `getCatalogMatchesForFen`,
  `getOpeningEndingAt`, `getOpeningForLine`, `buildCatalogPreview` and
  `buildDefaultCatalogTree`. Results are cached in module-level Maps.
  - `getCatalogMatchesForFen` lists the openings that pass through a position, longest line
    first, so its first result is not the position's name. To name a position or a line, use
    `getOpeningEndingAt` or `getOpeningForLine`.
- **The catalog tree is small.** `buildDefaultCatalogTree()` prunes with
  `CATALOG_TREE_MAX_DEPTH` and `CATALOG_TREE_MAX_CHILDREN`. As of 2026-08-11 it yielded
  264 non-root nodes to depth 5, from an index of 3,690 openings. That is a hard ceiling
  for any visualization built on it, and the territory map would need a wider tree.
- **Opening names come from `openingCatalogIndex.json` for labeling.** The ECO volumes
  provide natural top-level groupings.

## Storage and database

Supabase Postgres with Row Level Security on every table. Columns are in
`src/types/database.ts`; this section covers purpose and policy.

| Table | Purpose | Access (RLS) |
|---|---|---|
| `profiles` | Extends `auth.users` with display info | Own row only |
| `opening_books` | User books: `trees` (a list of `MoveNode` trees), `summary` and `origin` (`src/lib/library/types.ts`); `move_node` keeps the tree from the starting position until the old books move (`plans/deployment.md` Phase 5) | Own books; public books readable by authenticated users, so the app's queries also name the user |
| `training_sessions` | Result of each training run | Private |
| `position_cache` | Cached Lichess explorer responses, keyed by `position_key` | Read: authenticated · Write: service role. The app itself reads and writes it on the server with the service role, so guests can be served |
| `usage_counters` | Calls per (user, day, kind), with one shared row for guests | Service role only |
| `access_codes` | One-time invite and reset codes for the beta, stored as hashes | Service role only |
| `puzzles` | Imported Lichess puzzle dump | Read: authenticated |
| `puzzle_history` | Per-user puzzle attempts, unique per (user, puzzle) | Private |
| `user_position_stats` | Per (user, position_key, book) visit/success/failure counts | Private |
| `position_evals` | Engine evals per (position_key, depth), filled lazily by client Stockfish | Read: authenticated · Write: service role |
| `drills` | Pre-generated drills: an intentional computer mistake plus the punishment line the user must find | Private |
| `drill_attempts` | Log of individual drill attempts | Private |

- **Drills.** A drill starts from a position in the user's book. The computer plays a
  mistake, and the user must find the forced punishment line up to a position where several
  good moves exist. Difficulty is `mistake_depth + line_length - log(eval_drop)`.
- **The weakness score is computed at query time and not stored:**
  `(failure_count + 1) / (times_visited + 2) × log(1 + days_since_last_visit)`, which is
  Laplace-smoothed.
- **Position stats are an overlay, not a graph database.** Books hold the user's authorial
  choices, one response per position. The global position graph already exists as the
  in-memory catalog index. At this scale a Supabase `positions`/`edges` model adds round
  trips and no benefit.
- **The baseline migration holds the whole schema.** The first ten tables were created outside
  migrations, so `supabase/migrations/20261007170000_baseline.sql` records the live schema as
  of 2026-10-07 (`scripts/sql/schemaSnapshot.sql` prints it). A new project runs the baseline
  and the migrations after it; the earlier ones are history. Every schema change gets a
  migration (see `AGENTS.md`).
- **Call counts.** `increment_usage` adds one to a `usage_counters` row and returns the new
  count in a single statement. `recordUsage` (`src/lib/db/usage.ts`) calls it from every
  route handler and before every live Lichess request. The counts exist to choose per-user
  ceilings from (`plans/deployment.md`, D8).
- **As of 2026-09-29, no application code reads or writes `user_position_stats`,
  `position_evals` or `drills`.** They exist for the trainer.

## Compute strategy

Vercel functions only do `SELECT … WHERE pk = ?` and single-row `INSERT`/`UPDATE` (a capped
batch of primary-key reads is planned, `plans/data-delivery.md`). Anything that iterates,
walks trees or aggregates runs client-side.

| Operation | Where | Why |
|---|---|---|
| Opening name lookup | Client (in-memory catalog) | Instant, with no round trip |
| Master game stats | Vercel API → `position_cache` → Lichess (signed-in users only) | Proxied and cached; guests read the cache |
| Count a call | Vercel API → `increment_usage` | Single-row upsert |
| Fill the cache for the catalog | Local script (`npm run cache:prefill`) | Thousands of Lichess calls, so never on Vercel |
| Engine analysis | Client (Stockfish Web Worker) | WASM runs in the browser, so the server pays nothing |
| Report an eval to the DB | Vercel API → upsert `position_evals` | Single-row write with the service role (not built yet) |
| Generate drills from a book | Client (walks the book's trees, joins `position_evals`) | Light local computation |
| Store a generated drill | Vercel API → insert `drills` | Single-row write |
| Pick the weakest drills | Client (one fetch plus an in-memory sort) | Light query |
| Record a drill result | Vercel API → upsert `user_position_stats` + `drill_attempts` | Single-row writes |

## Engine

- **The engine runs entirely in the browser**, which means no server compute cost and no
  queue. `src/hooks/useEngine.ts` creates a Web Worker directly from
  `public/engine/stockfish-18-lite-single.js` (light mode) or `stockfish-18-lite.js` (heavy,
  multithreaded mode).
- **Multithreading needs `SharedArrayBuffer`.** That in turn needs the
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
  headers, which are set in `next.config.ts`.
- **Two engine files are empty stubs:** `src/workers/stockfish.worker.ts` and
  `src/components/board/EngineWorker.ts`. The engine logic is in `useEngine.ts`.
- **The full-size `stockfish-18-single` build is gitignored and unused** (107 MB).

## External data sources

- **Lichess Opening Explorer.** The app uses the masters endpoint at
  `explorer.lichess.ovh/masters`. Since March 2026 it requires a personal API token
  (`Authorization: Bearer`) because of DDoS protection. All calls are proxied, and only a
  signed-in user's request or the local pre-fill script can cause one; see
  `processes/lichess-api-and-caching.md`.
- **Lichess opening names.** The static dataset from `github.com/lichess-org/chess-openings`
  is bundled locally (see "Opening catalog").
- **Lichess puzzle database.** The CSV dump from `database.lichess.org/#puzzles` is imported
  into `puzzles`. There are no runtime puzzle API calls.
- **Hosting.** The app runs on Vercel and the Supabase free tier. If the Vercel URL is shared
  publicly, set up an uptime ping (for example UptimeRobot, every 24 hours) so Supabase
  doesn't auto-pause.

## Auth and API routes

- Supabase Auth uses `@supabase/ssr`. `src/lib/supabase.ts` exports the browser and server
  clients.
- Sign-in uses `signInWithPassword()`. The server resolves the user with
  `supabase.auth.getUser()`.
- **Guests use the app without an account.** There is no landing page: `/` redirects to
  `/dashboard` (`next.config.ts`). `src/lib/auth/access.ts` lists the sidebar pages and the
  visualizations, which of them need an account, and the guest and account differences
  shown on the Overview page. The sidebar, `src/proxy.ts`, the Overview and the
  Visualizations page all read it, and the pages themselves are in `design/dashboard.md`.
  The decisions and the full table are in `plans/deployment.md` (D16–D20).
- **Three layers enforce it.** The proxy redirects a guest away from an account-only page.
  Every route handler except the explorer returns 401 without a user, and the explorer
  serves a guest from the cache only. The UI then avoids offering what would fail:
  `getViewer()` (`src/lib/auth/viewer.ts`) tells Server Components who is viewing, and
  `useViewer()` (`src/context/Viewer.tsx`) tells client components, so pages skip book
  reads for a guest and show a sign-in notice in place of the save controls. The UI layer
  is a courtesy, not a security boundary.
- **A returning user is signed back in** because the Supabase cookies persist and the proxy
  refreshes the session on every dashboard request. Sign out is a server action in
  `src/app/dashboard/layout.tsx`.
- Public sign-up is turned off in Supabase. An account is created on the server with the
  admin API, already confirmed, and only in exchange for a one-time invite code
  (`registerWithInvite` in `src/lib/auth/accounts.ts`). A forgotten password is set the same
  way with a reset code (`resetPasswordWithCode`). Both codes are made locally by
  `npm run invites:create`, which prints each one once; `access_codes` keeps only the hash.
  A code is used up by one conditional update, and released again if the step it paid for
  fails. The reasoning is in `plans/deployment.md` (D6, D14).
- The request path for route handlers is: client `fetch('/api/…')` → route handler (Zod
  validation) → `src/lib/db/*` or `src/lib/chess/*` → response.
- **The book routes** (`/api/openings/books` and `/api/openings/books/[bookId]`) list the
  viewer's books as summaries, and create, read, change and delete one book. Writes replay
  every move (`validateTrees` in `src/lib/library/validate.ts`) and recompute the summary. A
  change names the `updatedAt` it read, so a stale tab gets a 409 instead of overwriting. A
  refusal carries a `LibraryError` code (`src/lib/library/http.ts`), and
  `src/lib/library/accountStore.ts` is the client side.

## Stored vs computed

| Data | Where it lives | When it's computed |
|---|---|---|
| ECO opening catalog | `openingCatalogIndex.json` (repo) | Build time, committed |
| ECO tree structure | In-memory module cache | Once per process |
| Master-game moves at a position | `position_cache` | On demand and by the pre-fill script, kept permanently |
| Call counts | `usage_counters` | On every counted request |
| User book trees | `opening_books.trees` | Validated and summarized on every write; read when a book opens |
| A book's summary | `opening_books.summary` | On every write; the book list reads only this |
| Per-position training stats | `user_position_stats` | Per drill (not built yet) |
| Engine evaluations | `position_evals` | Lazily, by client Stockfish (not built yet) |
| Visualization layouts | Client | On config change, memoized |

**Storage gaps**, in rough order of how much they block:

1. **Game counts per catalog position.** Without them, the `games` weight mode can't work.
   `npm run cache:prefill` loads them into `position_cache` for every catalog position,
   which also removes cold-cache Lichess calls for those positions. The gap is closed for a
   database once the script has been run against it; nothing reads the counts as weights
   yet.
2. **Pre-warmed `position_evals`** for the catalog positions at moderate depth (16–18 ply),
   filled by a one-off offline script. The `engine` weight mode and the hyperbolic panel's
   ordering bias need these.
3. **Polygon geometry** for the territory map's top levels, which needs a new table (see
   `design/territory-map.md`).

## Dependencies

The visualization dependencies and what each is for. Removal status is in `AGENTS.md` under
"Kept on purpose". Sizes are rough gzipped estimates from 2026-05.

| Package | Used by | ≈ Size | Notes |
|---|---|---|---|
| `d3` v7 (meta-package) | `OpeningTreeFull` only | 80 KB | If the territory map is built, it would use individual d3 subpackages; the meta-package goes when `OpeningTreeFull` does |
| `three`, `@react-three/fiber`, `@react-three/drei` | `GlobeTest` only | 260 KB | Lab only; never in production visualizations |
| `@xyflow/react` | Nothing | 100 KB | Its only intended consumer (`BookBranchView`) was never built |
| `framer-motion` | Nothing | 30 KB | Was intended for globe↔branch transitions |

**Tooling.** `vitest` (dev only) runs the unit and property tests and the docs test
(`docs/docs.test.ts`); its config resolves the `@/*` alias
from `tsconfig.json`. It needs `@types/node` 22 or newer. The project uses 22, the oldest Node
line still supported, so the types never offer an API that a Node 22 deployment lacks
(local development runs Node 24). `tsx` (dev only) runs the TypeScript scripts in `scripts/`
that import from `src/`, since plain Node can't resolve the `@/*` alias.

**Browser tests.** `@playwright/test` (dev only) runs `e2e/` against the running app
(`playwright.config.ts`): the functional specs in Chromium, Firefox, WebKit and two phone
sizes, and the screenshot specs in `e2e/screens/` in Chromium only. The rest of the setup:

- **Explorer data.** Every spec imports `test` from `e2e/fixtures/test.ts`, which answers
  `/api/openings/explorer` from `e2e/fixtures/explorer.json`, so no test depends on the cache
  or Lichess. A position that isn't recorded gets the guest's 404. To add positions, run the
  specs once with `E2E_RECORD_EXPLORER=1` and `--workers=1`; as a guest that reads only the
  cache.
- **The test account.** Specs that need an account use the session that `e2e/auth.setup.ts`
  saves after signing in as `E2E_EMAIL` and `E2E_PASSWORD`. Without them those specs skip.
- **Screenshots** run locally only, against Windows baselines committed next to their spec.
  CI leaves them out because Linux renders fonts differently. They are temporary, and
  `npm run screens:flush` lists and deletes them. Specs made from bug reports go in
  `e2e/screens/bugs/`.
- **Run output** goes to `test-results/` and `playwright-report/`, which are gitignored and
  deleted by `npm run test:e2e:clean`. Traces and videos are kept only for failing tests.

**CI.** `.github/workflows/ci.yml` runs on every push and pull request: the typecheck, lint
with no warnings allowed, and Vitest in one job, and in the other the production build and
`npm run test:e2e`. The second job needs the repository secrets `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `E2E_EMAIL` and `E2E_PASSWORD`, and
`SUPABASE_SERVICE_ROLE_KEY` with `E2E_USAGE_USER_ID` (the test account's user id), which make
`recordUsage` count CI's guest calls against the test account. Its report is
kept for 5 days when a test fails.

These are not wanted: `cytoscape`, `vis-network`, `react-force-graph`, graph layout engines
(Cola.js, dagre, Graphviz WASM), physics engines (Cannon, Rapier) and shader libraries.
Force layouts are incompatible with containment, and nothing here needs a general graph
engine.

## Known issues and scaling

- **Books from before the library have no `trees` or `summary`** until they are moved
  (`plans/deployment.md` Phase 5). `src/lib/db/openings.ts` rebuilds them from `move_node`
  on each read, and every write still stores the starting position's tree there.
- **Lichess failures** (429 responses, an expired token) degrade silently to "no moves". See
  the Lichess process doc.
- **The catalog ships inside the client JavaScript.** `openingCatalog.ts` imports the index,
  so every page that names openings loads it as one script of about 10 MB (about 600 KB
  compressed), which a phone must parse. `plans/data-delivery.md` moves it to a compact
  static file.
- **Scaling.** Visualizations run in the browser, so server load doesn't grow as users pan or
  zoom. Server work amounts to `position_cache` reads, one `opening_books` read per session
  and eventually one `user_position_stats` upsert per drill move. All of that is comfortable
  on the Supabase free tier for guests and about 100 beta users; what runs out first is in
  `plans/deployment.md` (Notes, "Server limits").

## Rejected alternatives

These are recorded so that a future agent who rediscovers one of these ideas doesn't
relitigate it.

| Approach | Why it was dropped |
|---|---|
| **A force-directed or spring layout** (early prototypes) | It was the original source of the crossing-branch problem, and it is incompatible with both determinism and containment. |
| **A hand-rolled node-link SVG tree** (`OpeningTreeGraph` + `useMoveTreeLayout` with a Reingold–Tilford layout, around 2026-04) | It was chosen to "avoid D3/React Flow for a bounded tree," but it provides no containment. Expanding a node reflows the layout and the user loses their place. Its encodings (edge thickness for popularity, dash or color for engine eval) live on in the weight-mode system. |
| **Pie-style wedges as the containment mechanism** | Containment is topological, and organic polygons read as territory. `ChessMap`'s angular layout survives as a lab prototype only. |
| **A DAG keyed by position hash** | A DAG can't be drawn without either edge crossings or losing containment. Transposition awareness would be an annotation layer instead. |
| **Moving `openingCatalogIndex.json` or a global position graph into Supabase** | The in-memory index is already deduplicated and transposition-aware with O(1) lookups. The database version only adds round trips at this scale. |
| **Server-side Stockfish** | It would add compute cost and need a queue, while client WASM is free and fast enough. |
| **A separately pre-processed master-game tree** | The catalog index and `position_cache` already cover it. (The territory map's polygon cache stores a rendering artifact, not move data, so it doesn't contradict this.) |
