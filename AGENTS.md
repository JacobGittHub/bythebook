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
| Opening catalog | Pre-generated local ECO index (3690+ openings from Lichess ECO data, built by `scripts/buildCatalog.mjs` + `scripts/buildOpeningCatalogIndex.mjs`) |
| Opening stats | Lichess Opening Explorer API (`explorer.lichess.ovh`) - proxied through API routes, used for master-game win/draw/loss data |
| Puzzle data | Lichess puzzle database dump (imported into Supabase) |
| Deployment | Vercel |

---

## Repository Structure

```txt
scripts/
├── buildCatalog.mjs                  # downloads ECO TSV data from Lichess GitHub
└── buildOpeningCatalogIndex.mjs      # parses PGNs and emits openingCatalogIndex.json

src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Overview page — renders DashboardTree
│   │   ├── explorer/page.tsx         # Opening Explorer page
│   │   ├── train/
│   │   │   ├── page.tsx
│   │   │   └── [bookId]/page.tsx
│   │   ├── repertoire/page.tsx
│   │   ├── puzzles/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── openings/
│       │   ├── explorer/route.ts
│       │   ├── books/route.ts        # GET list, POST create
│       │   └── books/[bookId]/route.ts  # PATCH update moveNode
│       ├── training/
│       │   └── sessions/route.ts
│       ├── puzzles/route.ts
│       └── user/route.ts
├── components/
│   ├── ui/
│   ├── board/
│   │   ├── BoardBase.tsx             # sole react-chessboard wrapper, no game logic
│   │   ├── BoardInteractive.tsx      # playable board via useChessGame + scripted commands
│   │   ├── BoardDisplay.tsx          # static/thumbnail board
│   │   └── boardTheme.ts             # Lichess classic square/piece colors
│   ├── openings/
│   │   ├── OpeningExplorer.tsx       # top-level orchestrator for the explorer feature
│   │   ├── OpeningCatalogSearch.tsx  # search input
│   │   ├── OpeningCatalogResults.tsx # result cards with Highlight Path action
│   │   ├── OpeningCatalogTreePreview.tsx  # recursive move-tree visualization
│   │   └── OpeningMiniTree.tsx       # mini SVG look-ahead tree in the explorer sidebar
│   ├── repertoire/
│   │   ├── OpeningTreeFull.tsx       # D3 radial SVG tree — overview page
│   │   ├── DashboardTree.tsx         # orchestrates OpeningTreeFull + TreeNodePanel on overview
│   │   ├── TreeNodePanel.tsx         # right-side panel shown on node click
│   │   ├── BookEditor.tsx            # create-book form
│   │   └── BookCard.tsx              # book list card
│   ├── training/
│   └── puzzles/
├── lib/
│   ├── supabase.ts
│   ├── db/
│   │   ├── users.ts
│   │   ├── openings.ts               # listOpeningBooks, getOpeningBook, createOpeningBook, updateOpeningBookTree
│   │   ├── sessions.ts
│   │   ├── puzzles.ts
│   │   └── positionCache.ts
│   ├── chess/
│   │   ├── openingCatalog.ts         # search/match API + buildDefaultCatalogTree()
│   │   ├── moveTree.ts               # MoveNode tree construction and navigation
│   │   ├── linePlayback.ts           # ScriptedBoardCommand factory + prefix helpers
│   │   ├── lichessExplorer.ts        # Lichess master-games API client
│   │   ├── fen.ts                    # normalizeFen, toPositionKey, START_FEN
│   │   └── generated/
│   │       └── openingCatalogIndex.json  # auto-generated — do not hand-edit
│   └── validators/
│       └── schemas.ts
├── hooks/
│   ├── useChessGame.ts               # chess.js state wrapper (makeMove, undoMove, etc.)
│   ├── useOpeningExplorer.ts         # single-position Lichess explorer hook
│   └── useOpeningExplorerMulti.ts    # batched parallel Lichess fetches for history positions
├── types/
│   ├── database.ts                   # auto-generated by Supabase CLI — do not hand-edit
│   ├── chess.ts
│   ├── training.ts
│   └── user.ts
├── proxy.ts
└── workers/
    └── stockfish.worker.ts
```

---

## Opening Catalog Architecture

The opening catalog is entirely local and pre-generated — no runtime parsing or external API calls are needed to identify opening names and lines.

### Build pipeline

Two npm scripts populate the catalog data:

1. **`npm run catalog:download`** (`scripts/buildCatalog.mjs`)
   - Fetches ECO volumes A–E from `https://github.com/lichess-org/chess-openings`
   - Writes `src/lib/chess/ecoData.json` — raw `{ eco, name, pgn }` tuples

2. **`npm run catalog:index`** (`scripts/buildOpeningCatalogIndex.mjs`)
   - Replays every PGN with chess.js to generate per-move FENs and UCI strings
   - Writes `src/lib/chess/generated/openingCatalogIndex.json` (v2 format)

Both output files are committed to the repo so the app never generates them at runtime.

### Catalog index format (`openingCatalogIndex.json`)

```ts
{
  version: 2;
  openings: GeneratedCatalogOpening[];   // 3690+ entries
  indexes: {
    byEco: Record<string, string[]>;          // normalized ECO → opening IDs
    byUciPrefix: Record<string, string[]>;    // space-joined UCI line → opening IDs
    byPositionKey: Record<string, string[]>;  // board+turn+castling+ep → opening IDs
  };
}
```

All three indexes support O(1) lookup. `toPositionKey()` in `fen.ts` strips the halfmove and fullmove clock so transpositions that reach the same position are grouped together.

### Public API (`openingCatalog.ts`)

| Function | Description |
|---|---|
| `searchCatalogMatches(query, max)` | Full-text search by ECO code, name, or PGN |
| `getCatalogMatchesForUciLine(uciMoves, max)` | Openings where `uciMoves` is an exact prefix of the opening line |
| `getCatalogMatchesForFen(fen, max)` | Openings that reach the same board position (transposition-aware) |
| `buildCatalogPreview(matches, rootFen)` | Merge multiple lines into a single `MoveNode` tree for display |
| `buildDefaultCatalogTree()` | Build the full ECO catalog as a `MoveNode` tree for the overview radial tree (cached module-level) |

`CatalogMatch` objects and `MoveNode` trees are lazily built and cached in module-level Maps.

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
move_node jsonb
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
   npx supabase gen types typescript --project-id bcpkifxnjfjzfrqvpkby > src/types/database.ts
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

Opening repertoires are stored in the `move_node` JSONB column on `opening_books`, not as relational move rows.

### Chessboard Architecture & UX

We use a strict three-tier component architecture for chess boards to ensure consistency:
1. **`BoardBase`**: The only component that wraps `react-chessboard`. Handles theming (`boardTheme.ts`). Has NO game logic.
2. **`BoardDisplay` & `BoardInteractive`**: Wrappers around `BoardBase`. `BoardDisplay` is for static thumbnails. `BoardInteractive` is the playable board that hooks into `chess.js` via the `useChessGame` hook.
3. **Feature Compositions**: Pages like `OpeningTrainer` and `PuzzleBoard` compose `BoardInteractive` with side panels. They do not define separate board components.

**Critical UX Rule - Non-scrollable Board Pages:**
Any page featuring a main interactive chessboard (training, puzzles, explorer) MUST fit within the viewport height. The page body `body` must not scroll. Use `h-[calc(100vh-<header>)]` on the main layout loop. The board should scale to fit the available height (`size="full"`), and only side panels (like move histories) are allowed to overflow and scroll internally. A scrollable chessboard page is considered a poor UX pattern in this app.

**Visual Move Tree UI (Future Architectual Goal):**
The right-hand side panel of the Opening Trainer will eventually host a literal node-link visual graph (a tree diagram) where users can intuitively see branches and click to select their active training line. Because of this, all opening repertoire data (`opening_books.move_node`) MUST be structured as a deeply nested Tree (`MoveNode` with `children: MoveNode[]`), rather than a flat array of lines. Every node must be uniquely identifiable to support opaque/faded visual states in the graph rendering.

`MoveNode` shape:

```ts
type MoveNode = {
  id: string;
  san: string | null;
  uci: string | null;
  fen: string;
  children: MoveNode[];
};
```

The root node represents the starting position for the book and therefore uses `san: null` and `uci: null`.

---

### Tree Visualization Architecture

There are two distinct tree visualizations in this project. They share no code — different data, layout, interaction, and scale.

#### Mini Tree (`OpeningMiniTree`) — Opening Explorer sidebar

**Location:** `src/components/openings/OpeningMiniTree.tsx`

**Purpose:** A lightweight tree visualization combining played history with look-ahead continuations. Shows where the game has gone (history path) and where master games go from here (continuation branches), plus common alternatives at each historical position.

**Layout:** Horizontal left-to-right. Three logical sections:

1. **History path** — one node per played move in a linear left-to-right chain. Up to 40 history nodes in a horizontally scrollable container; auto-scrolls (via `requestAnimationFrame`) to the newest node when history grows. White moves use a cream fill; black moves use a dark fill.
2. **Current position node** — the last history node, rendered slightly larger.
3. **Continuation branches** — up to 3 nodes branching right from the current position, one per top master-game continuation.

**Alternate branches:** At each history node, up to 6 vertical branches fan above/below the main line — one per top master-game alternative that was NOT the move actually played. Alt nodes use the same white/black color coding. Alt node x-position: `histXs[i] - ALT_GAP` (placed just left of the history node they branch from). For odd alt counts the group is shifted downward by half a spacing so no alt falls exactly on the center line. Clicking an alternate navigates the board via `pendingPostResetMovesRef` + `pendingForwardMoves` queue.

**Key layout constants:**
```
NODE_STEP = 72         // horizontal distance between history layers (viewBox units)
ALT_GAP   = 20         // how far left of histXs[i] the alt circles sit
VB_H      = 240        // viewBox height; CY = 120
MAX_ALTS  = 6          // max alternate branches per history node
MAX_CONT  = 3          // max continuation nodes
```

**Edge width formula** (piecewise, used for both history and alternate edges):
```
GAMES_KNEE = 50_000 / GAMES_SAT = 2_000_000
MIN_W=1.2 / MID_W=4.1 / MAX_W=6.7
< KNEE: linear MIN_W → MID_W
≥ KNEE: linear MID_W → MAX_W (capped at SAT)
```

**Percentage labels:** All game-share labels use one decimal place (e.g., `0.3%`) to capture proportions at deep positions where values are sub-1%.

**Hover tooltip:** Floating overlay near the hovered node with a `BoardDisplay` mini board, SAN + ECO name, and W/D/B data where available. Hovering a continuation node syncs a board arrow via `hoveredMoveUci`.

**Click behavior:**
- History node → resets board and replays to that position.
- Continuation node → plays that move.
- Alternate node → resets and replays the alternate line.

**Data flow** (all data flows down from `OpeningExplorer`, no own API calls):
- `moveHistory` — history nodes and FENs
- `explorerMoves` — top continuations at current position
- `historyPlayedFractions` / `historyPlayedGames` — edge widths, computed via `useOpeningExplorerMulti`
- `historyAlternates` — up to 6 alts per position, computed via `useOpeningExplorerMulti`

**Rendering:** Pure React + SVG. No D3. Container height `h-64` (256 px).

**Does NOT:**
- Have its own API calls — all data is passed as props from `OpeningExplorer`.
- Interact with the highlighted opening line selection (that is the stats table's responsibility).

---

#### Repertoire Tree (`OpeningTreeFull`) — Dashboard Overview

**Location:** `src/components/repertoire/OpeningTreeFull.tsx`  
**Orchestrator:** `src/components/repertoire/DashboardTree.tsx`  
**Side panel:** `src/components/repertoire/TreeNodePanel.tsx`

**Purpose:** An interactive radial SVG tree showing the full ECO opening catalog overlaid with the user's book lines. Lives on the `/dashboard` (Overview) page. The user clicks nodes to explore positions; the right panel shows the board, master game stats, and book actions.

**Data source:** `buildDefaultCatalogTree()` in `openingCatalog.ts` — builds a `MoveNode` tree from the local ECO index at startup (no API calls). Branching limits by depth: `[8, 5, 4, 3, 2]`. User's book nodes are highlighted in emerald (`#059669`); catalog-only nodes use muted styling.

**Layout:** D3 radial tree (`d3.hierarchy` + `d3.tree`). Fixed per-depth radius (`PER_DEPTH_R = 60` viewBox units), overriding D3's default leaf-at-max-radius behavior. ViewBox: 500×500 centered at origin. Dot-grid background (SVG `<pattern>`). Pan/drag via mouse with a `dragOrigin` ref.

**Key visual states per node:**
- Book node (FEN in user's `bookFens` set): emerald fill + stroke
- Selected path ancestors: `var(--text-primary)` fill, thick stroke
- Search highlight: indigo (`#6366f1`)
- Catalog-only: `var(--bg-muted)` fill, muted stroke
- Ghost (expansion preview): dashed stroke, low opacity

**Side panel (`TreeNodePanel`):** Always rendered (shows placeholder when no node selected). Displays: position board, ECO name from catalog, master game stats via `useOpeningExplorer`, book actions (Add/Remove), "Open in Explorer" (navigates to `/dashboard/explorer?fen=...`), "Train this book".

**Book management:** `DashboardTree` handles book switching, ghost node expansion (top master continuations fetched once on click), and saving via `PATCH /api/openings/books/[bookId]`. Search bar highlights matching ECO paths via `searchCatalogMatches`.

**Library:** D3.js (`import * as d3 from "d3"`). No code shared with `OpeningMiniTree`.

---

#### On "pre-processing the opening tree"

The infrastructure already exists in two forms:
1. **`openingCatalogIndex.json`** — pre-generated at build time, covers 3,690 named openings. `buildDefaultCatalogTree()` reads this at runtime (cached module-level). Never fetches at request time.
2. **`position_cache` table** — demand-driven cache of Lichess master-game data per FEN. Warms as users explore.

Do not build a separate pre-processed master-game tree. The mini tree consumes `position_cache` indirectly via the explorer API route. The repertoire tree consumes the catalog and the user's `MoveNode` book.

### Opening Explorer

**Header card layout (two rows):**
- Row 1: Title "Opening Explorer" + inline subtitle/match info (left) | flip button | search bar (right).
- Row 2: Book selector (narrow, `w-44`) | "View Lines" dropdown (enumerates all leaf paths from active book's `moveNode`; selecting one replays that line) | "Add line" button (always visible, disabled when no book selected or no moves played; 20-move max).

**`initialFen` prop:** When the explorer is opened via `?fen=` URL param (e.g., from "Open in Explorer" in `TreeNodePanel`), it replays the catalog moves to reach that position on mount.

**Height:** `h-[calc(100vh-3.5rem)]`. The 3.5rem accounts for the dashboard layout's `py-3` (outer grid, 1.5rem) + `p-4` (content wrapper, 2rem). Do not use larger values — they leave empty card background at the bottom.

### Opening Explorer: Hybrid Matching and Navigator Model

The Opening Explorer (`src/components/openings/OpeningExplorer.tsx`) identifies the current board position using a two-stage hybrid match:

1. **Prefix match** — `getCatalogMatchesForUciLine(currentUciLine)` finds openings whose move sequence begins with the exact moves played. `matchMode = "prefix"`.
2. **FEN fallback** — if no prefix matches exist, `getCatalogMatchesForFen(currentFen)` finds openings that reach the same board position by any move order (transpositions). `matchMode = "position"`.

The `ExplorerMatchMode` type (`"prefix" | "position" | "none"`) is exposed in the status panel so users know whether the match is an exact line or a transposition.

**Navigator controls** live in the top bar: `|<`, `<`, Play/Pause, `>`, `>|`.

| Control | Behavior |
|---|---|
| `\|<` | Reset board to start; preserves the highlighted opening selection |
| `<` | Undo one move from actual board history |
| Play/Pause | Auto-advance along the highlighted line at 700 ms/move |
| `>` | Step one move forward along the highlighted line |
| `>\|` | Jump to the end of the highlighted line from the current position |

**Key invariant:** forward controls (`>`, `>|`, Play) operate on the **highlighted line** only. They are disabled when:
- no opening is highlighted (`selectedMatch === null`), or
- the board has diverged from the highlighted line (`isBoardOnHighlightedLine === false`).

Backward controls (`<`, `|<`) always operate on **real board history** and are never disabled by line alignment state.

When the board diverges, a helper message "Board is off the highlighted line." appears and the user must step back or reset to realign before forward navigation re-enables.

**Result cards** in `OpeningCatalogResults` expose only a **Highlight Path** action. Load/auto-play actions were deliberately removed — all playback lives in the top-bar navigator.

**`pendingForwardMoves` queue:** `>|` enqueues the remaining line moves so each one fires as the board acknowledges the previous scripted command, keeping board state and `moveHistory` in sync without timing hacks.

### Auth pattern

Supabase Auth with `@supabase/ssr`.

- `src/lib/supabase.ts` exports the browser and server auth clients
- Sign in and sign up use `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`
- Route protection is handled in `src/proxy.ts` — Next.js 16 renamed "middleware" to "proxy". The file must be named `proxy.ts` and must export a function named `proxy` (not `middleware`). The `config.matcher` export works the same as before.
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
LICHESS_API_TOKEN=lip_...
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
- Master games endpoint: `GET /masters?fen=<FEN>&moves=<N>`
- **Authentication:** As of March 2026, requires a Personal API Token (`Authorization: Bearer <TOKEN>`) due to DDoS protections.
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
- Do not hand-edit `src/types/database.ts` — it is auto-generated by the Supabase CLI
- Do not hand-edit `src/lib/chess/generated/openingCatalogIndex.json` — regenerate it with `npm run catalog:index`
- Do not change the Supabase schema without writing a migration file
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Do not store opening tree moves as relational rows
- Do not add Load or auto-play actions to `OpeningCatalogResults` result cards — all playback is controlled by the top-bar navigator in `OpeningExplorer`
- Do not add forward-navigation logic that bypasses the `isBoardOnHighlightedLine` check — forward controls must be gated on board alignment with the highlighted line
- Do not rename the `proxy` export in `src/proxy.ts` to `middleware` — Next.js 16 requires the export to be named `proxy`, not `middleware`
- Do not use the React Compiler — it is not enabled in this project
- Do not use D3.js in `OpeningMiniTree` — it uses pure React + SVG only. D3 is only used in `OpeningTreeFull`.
- Do not give `OpeningMiniTree` its own API calls — it consumes `explorerMoves`, `historyPlayedFractions`, and `historyAlternates` passed as props from `OpeningExplorer`. All Lichess data flows through `OpeningExplorer`.
- Do not use `h-[calc(100vh-8rem)]` or other large offsets for the explorer height — the correct value is `h-[calc(100vh-3.5rem)]` based on the dashboard layout's actual padding (see Opening Explorer section).
<!-- END:nextjs-agent-rules -->
