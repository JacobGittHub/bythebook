# Opening Explorer and the book views

**Status:** Live
**Files:** `src/components/openings/` (`OpeningExplorer.tsx` is the orchestrator, plus
`ExplorerParts`, `Scoresheet`, `ExplorerTreeWindow`, `OpeningCatalogSearch`,
`OpeningCatalogResults` and `OpeningCatalogTreePreview`), `src/hooks/useOpeningExplorer.ts`,
`src/hooks/useOpeningExplorerMulti.ts`; the book views in `src/components/books/` and
`src/lib/books/views/`, with their tree in `src/lib/books/viewTree.ts` and the Explorer's
tree in `src/lib/books/explorerTree.ts`

## Rules

- **Result cards expose only Highlight Path.** Don't add Load or auto-play actions to
  `OpeningCatalogResults`. All playback belongs to the navigator under the scoresheet.
- **Forward navigation must be gated on alignment.** Never add forward navigation that
  bypasses the `isBoardOnHighlightedLine` check.
- **The page fits its pages of the book at every width,** by the board-page rule under "UI"
  in `AGENTS.md`. The board is as big a square as its box holds (`BoardSlot`, a size
  container), and only the master moves, the scoresheet and the views scroll inside it.
- **The book views use pure React + SVG.** No D3 and no Three.js.
- **The tree window makes no API calls of its own.** It receives everything as props from
  `OpeningExplorer`, and all Lichess data flows through `OpeningExplorer`.
- **Hovering never lays a view out again** (see "Book views" below).

## Explorer layout

The Explorer is a spread of the book (`plans/book-ui.md` D6, D7), with no boxes around its
parts.

- **The left page** holds the flip button and the search, then a row with the book selector,
  "View lines" and "Add line", then the board with its evaluation bar.
  - The books come from the viewer's library, guests' included (`useLibraryBooks`,
    `useLibraryBook` in `src/context/Library.tsx`), and the chosen book's trees are read
    when it is chosen.
  - "View lines" lists every leaf path in the chosen book, and picking one replays that line.
    A phone leaves it out, so the row stays one line.
  - "Add line" is disabled when no book is chosen or no moves have been played, and saves at
    most 20 moves. A book that changed in another tab is reloaded instead of saved, and a
    toast says so (`STALE_BOOK_MESSAGE`).
- **The right page** stacks three slots (`Slot` in `ExplorerParts`), each a small-capitals tab
  over a rule: the tree window, the engine, and the master moves. The tree window's head has
  the Book, Explored and Labyrinth tabs (D16, D17, see below) and the swap button. The
  slots are fixed in size; the swap is the way to a bigger view.
- **The scoresheet** (`Scoresheet`) is the page's only move list, in the right page's outer
  margin: White's and Black's moves under their move numbers, with the ply and the
  navigator's buttons under it. While the board is on a line picked from the search or "View
  lines", it lists that line to its end, the moves ahead faint; otherwise it lists the moves
  played. Pressing a move goes to it.
- **The swap** (D7) moves the tree window to the left page at full size and the board to the
  right page's top slot, still playable; the one button stays at the right end of that slot
  and says "Swap back". The board keeps its game inside itself (`useChessGame`), so it is
  rendered once into a node of its own (`react-reverse-portal`), which the swap moves
  between the pages without mounting the board again.
- **The running heads and folios** name the opening's family on the left and its variation
  and ECO code on the right, the side to move and the chosen book at the left foot, and how
  the position matched the catalog and its master games at the right.
- **The one-page form** (D15) has the search and the book row on top, then the board, as
  big as about half the page lets it be, and under it one column that scrolls on its own: the
  scoresheet as a row (pinned), the master moves (whose head also says how the position
  matched), the engine and the tree window. It has no swap.

**Master stats for a guest.** The route answers 404 for a position the server hasn't saved
(see `processes/lichess-api-and-caching.md`). The move list then says that a live lookup
needs a beta account; it is not shown as a failure.

**Opening at a position or a book.** With a `?fen=` URL parameter (for example from "Open in
Explorer" in the Treemap or the Labyrinth), the explorer replays the catalog moves that reach
that position on mount. With `?line=` (UCI moves from the start, `parseLineParam`) it replays
those moves instead, up to the first illegal one (`replayUciLine`), and `?book=` chooses a
book. The Library, the Bookstore, the small visualizations and New book send these
(`explorerHref`, `src/lib/library/links.ts`), so a position off the catalog opens too.

## Hybrid matching

The current position is identified in two stages:

1. **Prefix match.** `getCatalogMatchesForUciLine(currentUciLine)` finds openings whose line
   begins with the exact moves played. This sets `matchMode = "prefix"`.
2. **FEN fallback.** If there is no prefix match, `getCatalogMatchesForFen(currentFen)` finds
   openings that reach the same position by another move order. This sets
   `matchMode = "position"`.

`ExplorerMatchMode` (`"prefix" | "position" | "none"`) is shown in the right page's folio, so
the user knows whether a match is an exact line or a transposition.

## Navigator

| Control | Behavior |
|---|---|
| `\|<` | Reset to the start and keep the highlighted opening |
| `<` | Undo one move of the real board history |
| Play/Pause | Auto-advance along the highlighted line (`AUTO_PLAY_DELAY_MS`) |
| `>` | Step one move along the highlighted line |
| `>\|` | Jump to the end of the highlighted line |

The navigator's state and rules are a pure reducer, `navigatorReducer` in
`src/lib/chess/explorerNavigator.ts`, with Vitest tests. `OpeningExplorer` dispatches the
user's clicks and the board's reports to it, and passes its `command` to the board.

- **Forward controls** (`>`, `>|`, Play) act only on the highlighted line. They are disabled
  when nothing is highlighted or when the board has left the line (`lineIndex` is -1). In
  the second case the UI shows "Board diverged from highlighted line." with a "Clear line"
  link, and the user steps back or resets to realign.
- **Backward controls** (`<`, `|<`) act on the real board history, and are disabled only at
  the start position.
- **`>|` queues the remaining moves in the navigator's `pending` list.** Each move is sent
  as the board reports the one before, which keeps the board and the navigator's `history`
  in sync without timing hacks.
- **Jumping to an earlier or different position** (a history node, an alternate, a book
  line, a move token) resets the board and replays the moves, held in `afterReset` until
  the board reports the reset.
- **Opening at a position** (`initialFen`, from "Open in Explorer" on the Treemap and the
  Labyrinth) replays `getCatalogLineToFen`: the longest named line through the position,
  cut off at it. That replay is the navigator's initial state, so nothing runs in an effect.

## Tree window (`ExplorerTreeWindow`)

The window at the right page's top draws the explored line, or the chosen book, with one of
the five book views, picked on the vertical rail (`BookViewRail`) along its left edge. Spine
and ribs is the default (`DEFAULT_EXPLORER_VIEW`), and the choice is kept in the browser for
every viewer, guests included.

**With a book chosen it draws the book** (`plans/book-ui.md` D17), weighted by its lines,
with the current position selected and the spine running through it. The moves played past
the book's end are added from where the line left it, marked `out`, and every view draws
their edges dashed (`bookLineTree` in `src/lib/books/explorerTree.ts`, pure and tested); the
left running head says "In book" or "Out of book". The Explored tab goes back to the
explored line; choosing another book goes back to the book. The Labyrinth's tab says
"coming soon" (D16).

**What it draws** (`explorerTree`, pure and tested):

- the played line, pinned so every view draws it as its main line;
- at each of its positions, up to `EXPLORER_ALTERNATES` master moves that weren't played;
- at the current position, up to `EXPLORER_CONTINUATIONS` master moves.

Moves are weighted by master games (the views' `games` weight): a rib's dot and label show
its share of the position's games, and the icicle's blocks are sized by games.

**Hover** shows a floating board (`PositionTooltip`) with the move, its opening and, when
known, its game count and results. Hovering a move from the current position also draws its
arrow on the board.

**Click**

- A move from the current position plays it.
- Any other position resets the board and replays the line to it, as described in the
  Navigator section.

**Data flow (all props)**

```
OpeningExplorer (owns all fetching)
  ├─ useOpeningExplorer(currentFen)   → the current position's master moves
  ├─ useOpeningExplorerMulti(history) → the master moves before each played move
  │                                     (parallel calls, one per position)
  └─ → ExplorerTreeWindow (props only) → explorerTree → BookView
```

The data is transient and changes with every move. Caching happens one layer down, in
`position_cache`.

`OpeningMiniTree`, the earlier tree, is no longer shown; it is kept (`AGENTS.md`, "Kept on
purpose").

## Book views

Five ways of drawing a book, or the explored line, as a tree laid out left to right so depth
gets the room (`BOOK_VIEWS`). They share a tree (`buildViewTree`), a frame (`BookView`) and
their marks and colors (`.bv-*` and the `--view-*` and `--fam-*` tokens in `globals.css`);
each has its own layout and renderer. The Explorer's tree window and the small visualization
pages (`dashboard.md`) show them. They came from concept mockups the user ranked on
2026-10-06, in the order `BOOK_VIEWS` lists them; the mockups are kept in
`docs/design/mockups/`.

| View | Layout | Draws |
|---|---|---|
| Ply columns | `plyColumnsLayout` | Every position as a dot, one column per ply; edges thicken with what is behind them |
| Metro map | `metroLayout` | Heavy paths as routes of stations, colored by family, each ending in a terminus bar; the main line and each family carry its name |
| Spine and ribs | `spineLayout` | One line straight across, its other moves as ribs; clicking a rib re-routes the spine down it |
| Icicle | `icicleLayout` | Each move as a block whose height is its share of its parent's lines (or games) |
| Branch points | `branchPointsLayout` | Runs of single moves as one stretch; branches under `BRANCH_FOLD_BELOW` positions fold into "+n" unless the selection is in them |

**Rules**

- **Layouts are pure:** `layout(tree, box, options)`, with property tests of their
  invariants in `src/lib/books/views/views.test.ts` (each position placed once, inside the
  box, children after their parents, rows and labels apart, the same output for the same
  input).
- **Hovering only changes classes.** Layouts read the selection, never the pointer, and the
  box a view is drawn in never depends on what it draws. The first spine mockup re-laid the
  view on hover, which moved the target out from under the pointer and back in a loop.
- **Metro routes in one row keep `METRO_ROW_GAP` columns apart,** and a route that shares a
  row is nudged off it by `METRO_NUDGE`, so a route ending and another starting further along
  never read as one line (the Marshall Defense ran into a Queen's Gambit Accepted branch in
  the mockup).
- **Siblings keep the tree's order:** pinned moves first, then by master games when every
  sibling has a count, else by positions behind them, then by UCI.
- **Families** are the moves the tree splits into where it first branches (`families`); the
  first `FAMILY_COLORS` get their own color.
- **A drawing bigger than its box scrolls,** and the selected position is scrolled into view
  when the selection changes.
- **Every view zooms** (`plans/deployment.md` D21) in the steps of `ZOOM_STEPS`
  (`src/lib/books/views/zoom.ts`), from −, Fit and + (`ZoomControls`), ctrl+wheel, or a
  two-finger pinch on a touch screen. Zoomed, the icicle is laid out again in a box that many
  times larger, so thin blocks grow until their moves fit; the other views keep their layout
  and are drawn bigger. Either way the drawing scrolls inside the same box, so nothing around
  it moves.

## Planned

- Color in the ply columns view (the user's note on the mockup, 2026-10-06).
- Editing a book from the views (`plans/bookstore.md`, Notes).
