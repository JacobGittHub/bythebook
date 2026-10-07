# Opening tree (Treemap page)

**Status:** Live, though legacy. The territory map (`territory-map.md`) is the candidate
successor. This tree stays until a successor ships and the user says otherwise.
**Files:** `src/app/dashboard/visualizations/treemap/page.tsx` renders
`src/components/repertoire/DashboardTree.tsx` (the orchestrator), which renders
`OpeningTreeFull.tsx` (the radial tree) and `TreeNodePanel.tsx` (the side panel, a wrapper
around `PositionPanel.tsx`).

The Treemap is the one live visualization on the Visualizations page
(`/dashboard/visualizations`), which has a route button for each visualization and features
the Labyrinth above it. Until
2026-10-01 the tree was the dashboard's Overview at `/dashboard`, which is now an info page.
Until 2026-10-02 the page was called the Atlas; that name now belongs to the planned static
region map (`plans/atlas.md`), and the old addresses redirect here (`next.config.ts`).

## Rules

- **`OpeningTreeFull` is the only place that uses D3.** It imports `d3` wholesale.
- **Don't add React Flow or Three.js here.**
- **Don't delete `OpeningTreeFull.tsx`** (see "Kept on purpose" in `AGENTS.md`).

## What it does

This is an interactive radial SVG tree of the ECO catalog, overlaid with the user's book
lines. Clicking a node selects it, and the side panel shows that position's board, name,
master stats and book actions.

## Data

```
DashboardTree
  ├─ buildDefaultCatalogTree()        local and in-memory, with no API calls (limits in architecture.md)
  ├─ opening_books (listOpeningBooks) the user's books → bookFens, a Set of every FEN in them
  │                                   (the page skips this read for a guest, who has no books)
  ├─ useOpeningExplorer(selectedFen)  on click: top master moves for the "ghost" expansion
  │                                   (goes through position_cache; the result isn't persisted)
  └─ ghostExpansions                  local state: Map<nodeId, DisplayNode[]>
```

## Layout

- The layout is a D3 radial tree (`d3.hierarchy` + `d3.tree`).
- Each depth level gets a fixed radius (`PER_DEPTH_R`) instead of D3's
  leaves-at-maximum-radius default.
- The viewBox is centered at the origin and drawn over a dot-grid `<pattern>` background.
- Pan and drag are handled through the `dragOrigin` ref, with pointer events so that a
  finger drags the tree as a mouse does.
- On a narrow screen the side panel sits under the tree instead of beside it, and takes at
  most half the page's height.

## Node states

| State | Look |
|---|---|
| Book node (its FEN is in `bookFens`) | Emerald fill and stroke (`#059669`) |
| Ancestor on the selected path | `var(--text-primary)` fill with a thick stroke |
| Search highlight | Indigo (`#6366f1`) |
| Catalog-only | `var(--bg-muted)` fill with a muted stroke |
| Ghost (expansion preview) | Dashed stroke at low opacity |

## Side panel (`TreeNodePanel`)

The panel is always rendered and shows a placeholder when nothing is selected (on a narrow
screen the placeholder is hidden to leave the tree its room). Its layout is `PositionPanel`,
which the Labyrinth's panel shares (`region-map.md`); `TreeNodePanel` supplies the tree's
data and buttons. It contains:

- The position board, whose pieces slide when the selection changes (`BoardDisplay`'s
  `animate`)
- The opening's name: `getOpeningForLine` gives the opening that ends at the node or,
  failing that, at the nearest position before it on the selected path
- Master-game stats, via `useOpeningExplorer`, added up from the listed moves
  (`summarizeMasterGames`)
- Add/Remove book actions
- "Open in Explorer", which goes to `/dashboard/explorer?fen=…`
- "Train this book"

## Book management

`DashboardTree` handles:

- Switching between books
- Ghost expansion, which fetches the top master continuations once per clicked node
- Saving through `PATCH /api/openings/books/[bookId]`
- The search bar, which highlights matching ECO paths via `searchCatalogMatches`

**Guests.** Books belong to accounts, so a guest (`useViewer()`) sees a sign-in notice in
place of the book selector and "+ New book", and the panel has no book actions. The tree,
the search and the master stats work the same. For a position the server hasn't saved, the
panel says a live lookup needs a beta account.

## Limits

- The radial layout visually saturates beyond about depth 5, and the catalog tree itself is
  capped at depth 5.
- User books aren't depth-limited, but deep lines crowd the outer rings.

## Planned

- If the territory map ships, `DashboardTree` switches its import to it.
