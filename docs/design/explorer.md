# Opening Explorer and the book views

**Status:** Live
**Files:** `src/components/openings/` (`OpeningExplorer.tsx` is the orchestrator, plus
`ExplorerTreeWindow`, `OpeningCatalogSearch`, `OpeningCatalogResults` and
`OpeningCatalogTreePreview`), `src/hooks/useOpeningExplorer.ts`,
`src/hooks/useOpeningExplorerMulti.ts`; the book views in `src/components/books/` and
`src/lib/books/views/`, with their tree in `src/lib/books/viewTree.ts` and the Explorer's
tree in `src/lib/books/explorerTree.ts`

## Rules

- **Result cards expose only Highlight Path.** Don't add Load or auto-play actions to
  `OpeningCatalogResults`. All playback belongs to the top-bar navigator.
- **Forward navigation must be gated on alignment.** Never add forward navigation that
  bypasses the `isBoardOnHighlightedLine` check.
- **The page fits the viewport at every width,** by the board-page rule under "UI" in
  `AGENTS.md`. Below the `xl` breakpoint the board sits on top, as a square capped at a
  share of the viewport height (the `max-w-[…dvh]` class on the board's container), and the
  panels sit under it in one column that scrolls on its own: the move row first (pinned),
  then the statistics, the engine and the tree window. At `xl` and wider the board is beside
  the panel column and only the statistics panel scrolls.
- **The book views use pure React + SVG.** No D3 and no Three.js.
- **The tree window makes no API calls of its own.** It receives everything as props from
  `OpeningExplorer`, and all Lichess data flows through `OpeningExplorer`.
- **Hovering never lays a view out again** (see "Book views" below).

## Explorer layout

The cards sit straight on the page, without a tinted panel around them, and keep their
padding small.

The header card has two rows:

1. The title and inline match info on the left, then the flip button and the search bar. On
   a phone the title is hidden and the search bar takes its place.
2. A book selector, a "View Lines" dropdown and an "Add line" button, for guests too: the
   books come from the viewer's library (`useLibraryBooks`, `useLibraryBook` in
   `src/context/Library.tsx`), and the chosen book's trees are read when it is chosen. On a
   phone "View Lines" is left out and "Add line" drops its move count, so the row stays one
   line and the sticky header never covers the panels under it.
   - "View Lines" lists every leaf path in the active book, and selecting one replays that
     line.
   - "Add line" is always visible. It is disabled when no book is selected or no moves have
     been played, and lines are capped at 20 moves. A book that changed in another tab is
     reloaded instead of saved (`STALE_BOOK_MESSAGE`).

**The side panels can be resized.** Each panel above the statistics (the engine while it is
on, the tree window and, at `xl`, the move row) has a `ResizeHandle`
(`src/components/ui/ResizeHandle.tsx`) under it: drag it, or focus it and use the arrow
keys, between the limits in `PANEL_LIMITS`; double-click puts the panel back. The statistics
take the height that is left, down to a minimum, after which the panel column scrolls. A move
row given a height wraps its moves instead of scrolling sideways. The heights are kept in
the browser (`useStoredString`), per viewer.

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

`ExplorerMatchMode` (`"prefix" | "position" | "none"`) is shown in the status panel, so the
user knows whether a match is an exact line or a transposition.

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

The window under the engine draws the explored line with one of the five book views, picked
on the vertical rail (`BookViewRail`) along its left edge. Spine and ribs is the default
(`DEFAULT_EXPLORER_VIEW`), and the choice is kept in the browser for every viewer, guests
included.

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
- Drawing the active book in the tree window, and editing a book from the views
  (`plans/bookstore.md`, Notes).
