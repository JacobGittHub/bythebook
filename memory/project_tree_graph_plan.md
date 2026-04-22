---
name: Opening Tree Graph UI Plan
description: Planned node-link SVG tree visualization for the opening explorer and trainer, including sequencing, tech choices, and design decisions
type: project
---

User wants a visual node-link tree diagram to replace/augment the current `OpeningCatalogTreePreview` text list. Mockup was drawn in Canvas — black background, circular nodes, edges connecting moves in a branching tree.

**Visual encodings:**
- Edge **thickness** → popularity (master-game move counts from Lichess Explorer API)
- Edge **dashedness** (or color — user open to changing this) → engine evaluation quality
- Selected/active node → distinct highlight style with ECO/move label shown
- Smooth transitions (not floating/random) — possibly vertically scrollable

**Sequencing (do in this order):**
1. Wire up `useOpeningExplorer` hook to actually call `/api/openings/explorer` (currently a stub) — needed for real popularity data
2. Create `DisplayMoveNode` type wrapping `MoveNode` with `popularity?: number` and `engineEval?: number` — avoids mutating `MoveNode` and breaking catalog code
3. Build `OpeningTreeGraph` as a custom SVG component with a `useMoveTreeLayout(root)` hook (Reingold–Tilford-style recursive layout)
4. Add Stockfish eval lazily per-node once the graph renders real data

**Tech: custom SVG + CSS transitions (no graph library)**
- Layout: single recursive hook returning `{ id, x, y, ...node }` per node
- Rendering: plain `<svg>` with `<circle>` and `<line>`/`<path>` elements
- Edge thickness: SVG `strokeWidth` from popularity
- Transitions: CSS `transition` or Framer Motion (`motion.circle`, `motion.line`) for animated layout changes
- Scrolling: SVG inside `overflow-y: auto` container; `scrollIntoView({ behavior: 'smooth' })` to track active node

**Why:** avoid D3/React Flow — overkill for a bounded chess tree, fights React's state model. Framer Motion (~30KB gzipped) is acceptable addition if animated transitions are desired.

**On dashedness:** user may change to color encoding. Color along the edge (neutral gray → cool blue for engine favorites, warm amber for dubious) reads more intuitively than dash patterns.

**Why:** This is blocked on master-games data and `DisplayMoveNode` design. Build data layer first.
