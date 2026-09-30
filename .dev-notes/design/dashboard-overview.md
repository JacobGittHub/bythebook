# Dashboard overview tree

**Status:** Live, though legacy. The territory map (`territory-map.md`) is the candidate
successor. This tree stays until a successor ships and the user says otherwise.
**Last reviewed:** 2026-09-29
**Files:** `src/app/dashboard/page.tsx` renders `src/components/repertoire/DashboardTree.tsx`
(the orchestrator), which renders `OpeningTreeFull.tsx` (the radial tree) and
`TreeNodePanel.tsx` (the side panel).

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
  ├─ useOpeningExplorer(selectedFen)  on click: top master moves for the "ghost" expansion
  │                                   (goes through position_cache; the result isn't persisted)
  └─ ghostExpansions                  local state: Map<nodeId, DisplayNode[]>
```

## Layout

- The layout is a D3 radial tree (`d3.hierarchy` + `d3.tree`).
- Each depth level gets a fixed radius (`PER_DEPTH_R`) instead of D3's
  leaves-at-maximum-radius default.
- The viewBox is centered at the origin and drawn over a dot-grid `<pattern>` background.
- Pan and drag are handled through the `dragOrigin` ref.

## Node states

| State | Look |
|---|---|
| Book node (its FEN is in `bookFens`) | Emerald fill and stroke (`#059669`) |
| Ancestor on the selected path | `var(--text-primary)` fill with a thick stroke |
| Search highlight | Indigo (`#6366f1`) |
| Catalog-only | `var(--bg-muted)` fill with a muted stroke |
| Ghost (expansion preview) | Dashed stroke at low opacity |

## Side panel (`TreeNodePanel`)

The panel is always rendered and shows a placeholder when nothing is selected. It contains:

- The position board
- The ECO name from the catalog
- Master-game stats, via `useOpeningExplorer`
- Add/Remove book actions
- "Open in Explorer", which goes to `/dashboard/explorer?fen=…`
- "Train this book"

## Book management

`DashboardTree` handles:

- Switching between books
- Ghost expansion, which fetches the top master continuations once per clicked node
- Saving through `PATCH /api/openings/books/[bookId]`
- The search bar, which highlights matching ECO paths via `searchCatalogMatches`

## Limits

- The radial layout visually saturates beyond about depth 5, and the catalog tree itself is
  capped at depth 5.
- User books aren't depth-limited, but deep lines crowd the outer rings.

## Planned

- Add `OpeningTreeFull` as a tab on the lab page.
- If the territory map ships, `DashboardTree` switches its import to it.
