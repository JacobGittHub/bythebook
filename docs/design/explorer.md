# Opening Explorer and mini tree

**Status:** Live
**Last reviewed:** 2026-10-01
**Files:** `src/components/openings/` (`OpeningExplorer.tsx` is the orchestrator, plus
`OpeningCatalogSearch`, `OpeningCatalogResults`, `OpeningCatalogTreePreview` and
`OpeningMiniTree`), `src/hooks/useOpeningExplorer.ts`, `src/hooks/useOpeningExplorerMulti.ts`

## Rules

- **Result cards expose only Highlight Path.** Don't add Load or auto-play actions to
  `OpeningCatalogResults`. All playback belongs to the top-bar navigator.
- **Forward navigation must be gated on alignment.** Never add forward navigation that
  bypasses the `isBoardOnHighlightedLine` check.
- **The explorer height is `h-[calc(100dvh-var(--dash-offset))]`.** `DashboardShell` sets
  `--dash-offset` to the height of everything around the content (the padding, the card's
  border and, on a phone, the top bar). A larger fixed offset leaves empty card background
  at the bottom, and `100vh` is too tall on a phone whose browser bar is showing.
- **The page fits the viewport at every width.** Below the `xl` breakpoint the board sits on
  top, as a square capped at a share of the viewport height (the `max-w-[…dvh]` class on the
  board's container), and the panels sit under it
  in one column that scrolls on its own: the move row first (pinned), then the statistics,
  the engine and the mini tree. At `xl` and wider the board is beside the panel column and
  only the statistics panel scrolls.
- **`OpeningMiniTree` uses pure React + SVG.** No D3 and no Three.js.
- **`OpeningMiniTree` makes no API calls of its own.** It receives everything as props from
  `OpeningExplorer`, and all Lichess data flows through `OpeningExplorer`.

## Explorer layout

The header card has two rows:

1. The title and inline match info on the left, then the flip button and the search bar. On
   a phone the title is hidden and the search bar takes its place.
2. A book selector, a "View Lines" dropdown and an "Add line" button. On a phone the
   selector takes a line of its own.
   - "View Lines" lists every leaf path in the active book, and selecting one replays that
     line.
   - "Add line" is always visible. It is disabled when no book is selected or no moves have
     been played, and lines are capped at 20 moves.
   - A guest (`useViewer()`) gets a sign-in notice in this row instead, and the book list is
     not requested, because books belong to accounts.

**Master stats for a guest.** The route answers 404 for a position the server hasn't saved
(see `processes/lichess-api-and-caching.md`). The move list then says that a live lookup
needs a beta account; it is not shown as a failure.

**`initialFen` prop.** When the explorer opens with a `?fen=` URL parameter (for example
from "Open in Explorer" in the Atlas), it replays the catalog moves to reach that position
on mount.

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

- **Forward controls** (`>`, `>|`, Play) act only on the highlighted line. They are disabled
  when nothing is highlighted (`selectedMatch === null`) or when the board has left the line
  (`isBoardOnHighlightedLine === false`). In the second case the UI shows "Board is off the
  highlighted line.", and the user steps back or resets to realign.
- **Backward controls** (`<`, `|<`) always act on the real board history and are never
  disabled.
- **`>|` enqueues the remaining moves in `pendingForwardMoves`.** Each move fires as the
  board acknowledges the previous scripted command, which keeps the board state and
  `moveHistory` in sync without timing hacks.

## Mini tree (`OpeningMiniTree`)

A small horizontal tree in the explorer sidebar. It shows where the game has gone, where
master games go from here, and the common alternatives at each earlier position.

**Layout (left to right)**

- **The history path** has one node per played move, up to `MAX_HISTORY` nodes. It scrolls
  horizontally and auto-scrolls (via `requestAnimationFrame`) to the newest node. White moves
  have a cream fill and Black moves a dark fill.
- **The current position** is the last history node, drawn slightly larger.
- **Continuations** are up to `MAX_CONT` nodes branching right, one per top master-game
  continuation.
- **Alternates** are up to `MAX_ALTS` per history node, fanned above and below the main line.
  Each is a top master move that was *not* the one played. They sit just left of their
  history node (`ALT_GAP`). An odd count is shifted down by half a spacing so no alternate
  sits on the center line.

**Encoding**

- **Edge width** grows with game count, piecewise-linearly from `MIN_W` up to a knee at
  `GAMES_KNEE`, then to `MAX_W` at saturation (`GAMES_SAT`).
- **Game-share labels** use one decimal place (for example `0.3%`), because deep positions
  have sub-1% shares.

**Hover.** Hovering a node shows a floating tooltip with a `BoardDisplay` mini board, the
SAN, the ECO name and W/D/B data. Hovering a continuation also draws a board arrow via
`hoveredMoveUci`.

**Click**

- A history node resets the board and replays to that position.
- A continuation plays that move.
- An alternate resets and replays the alternate line via `pendingPostResetMovesRef` and
  `pendingForwardMoves`.

**Data flow (all props)**

```
OpeningExplorer (owns all fetching)
  ├─ useOpeningExplorer(currentFen)   → explorerMoves (top continuations)
  ├─ useOpeningExplorerMulti(history) → historyPlayedFractions, historyPlayedGames,
  │                                     historyAlternates (parallel calls, one per position)
  └─ → OpeningMiniTree (props only)
```

The data is transient and changes with every move. Caching happens one layer down, in
`position_cache`.

## Planned

- Add `OpeningMiniTree` as a page under Visualizations.
- The hyperbolic panel (`hyperbolic-panel.md`) is the candidate successor in the sidebar.
  The mini tree stays until a successor ships and the user says otherwise.
