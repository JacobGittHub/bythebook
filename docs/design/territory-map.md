# Territory map

**Status:** This is the leading candidate for the dashboard's primary surface, but it is
**not settled**. Nothing has been built yet: `src/components/territory/` doesn't exist, the
dependencies aren't installed, and there is no geometry table. Don't start building it, or
shape other work toward it, unless the user asks.
**Last reviewed:** 2026-09-29
**Would replace:** `OpeningTreeFull` on `/dashboard` (see `dashboard-overview.md`)

Read `architecture.md` § "Visualization principles" first. Containment is the central rule
for this design.

**Being tested in the lab.** The "Regions" tab (`region-map.md`) is prototyping this map. It
departs from this doc in several ways: seeded balanced-bisection cells rounded into pebbles
with gaps instead of a Voronoi treemap with shared borders, top-p/top-k child selection with
an "Other" region, focus chains, and pins. When the prototype settles, reconcile this doc with
it, including the dependency table below (the prototype needs none of the Voronoi packages).

## Rules (for when it is built)

- **Render to Canvas 2D, never SVG.** Polygon counts reach the thousands.
- **No force-directed or spring layouts, in any form.** They break both determinism and
  containment.
- **Use d3 modules for layout math only.** They never touch the DOM.
- **Keep it separate from the hyperbolic panel.** It shares the data layer with the panel and
  nothing else. Building both as one configurable component is rejected, because they have
  different geometries, node budgets and interaction models.
- **No React Flow and no Three.js.**
- **It doesn't draw edges, and it doesn't re-root.** The root is always the start position.

## Job

This is the planning surface. It is where the user plans an opening repertoire and reviews
their own game history to find where their preparation runs out.

## Layout

- **A recursive Voronoi treemap.** Each level is a weighted (power) Voronoi diagram relaxed
  with Lloyd's algorithm. Site weights are adjusted iteratively until each cell's area
  matches its target share of the parent's area. Nesting produces the intended reading:
  continents resolving into countries, then territories, then cities.
- **No drawn edges.** Adjacency and hierarchy come entirely from shared borders and nesting,
  as on a real map. Border weight encodes depth, so higher-level boundaries are drawn heavier
  than the subdivisions inside them.
- **Determinism.** Initial site placement is seeded from a hash of the node's move sequence.
  The same tree and weight mode must give byte-identical geometry across runs and machines.
  Computed geometry is cached in the database so that the user's mental map never silently
  changes.
- **Precomputation.** The top three or four levels are precomputed server-side and stored as
  polygon geometry, which gives the benefit of a prerendered map without a raster tile
  pipeline. Deeper levels are computed lazily on expansion. That is safe because containment
  guarantees a new subtree can't disturb anything outside its parent's cell.
- **Weight-mode switching** changes areas only, never topology. It animates as a polygon
  vertex morph rather than a redraw, so the user watches the known-territory map deform into
  the engine's view of the same space.

## Semantic zoom

- **Detail follows importance, not geometric scale.** Each node has an importance score, its
  share of the root's games. A node becomes visible when `importance × scale² > threshold`.
  Because the threshold is continuous in scale, detail blooms smoothly instead of popping
  between tiers.
- **The threshold is exposed to the user as a "maximum visible nodes" control.** The real
  constraint was never raw node count. It is that a user can't attend to any single node
  when hundreds are on screen, so the right number is a matter of taste and belongs to the
  user.

## Labels

Labels are the main mechanism that makes the map memorable, so they are a first-class
feature.

- **Place labels at the pole of inaccessibility (`polylabel`), not the centroid.** Centroids
  fall outside concave polygons.
- **A region shows the most specific true name for itself at the current zoom.** For
  example, it reads "Sicilian" from far out, "Najdorf" closer in, and "Poisoned Pawn" closer
  still.
- **Names come from the catalog nomenclature** (`searchCatalogMatches` and
  `getCatalogMatchesForFen`), with the ECO volumes as the top-level groupings. They do not
  come from raw move counts.

## Data

```
Territory map container
  ├─ opening tree          buildDefaultCatalogTree() today, which is too small (264 nodes;
  │                        see architecture.md). The map needs a wider/deeper tree.
  ├─ weight mode           games (unbuilt: needs counts) | engine (needs position_evals) | subtree
  ├─ polygon geometry      new Supabase table, top 3–4 levels
  └─ opening_books         the user's book overlay
```

## Prerequisites

1. **Property tests.** Vitest is installed (`npm test`). The layout must ship with property
   tests: siblings are disjoint, every child lies inside its parent, and output is
   byte-identical across runs. `src/lib/regions/` (the lab region map) has examples.
2. **The shared tree module** (`src/lib/chess/openingTree.ts`) with the UCI tiebreak, and the
   **weights module** (`src/lib/chess/weights.ts`).
3. **A wider catalog tree** than the current prune allows.
4. **Game counts**, for the `games` mode (see the storage gaps in `architecture.md`).
5. **A migration for the geometry cache table.** It would be the repo's first real
   `create table` migration.

## Dependencies to install when building

Don't install these ahead of time. Install them in the task that first needs them.

| Package | Purpose |
|---|---|
| `d3-voronoi-treemap` | The recursive Voronoi treemap layout. Weighted Voronoi with Lloyd's relaxation is a hard numerical-stability problem, so this is the one place a layout library clearly earns its place. |
| `d3-weighted-voronoi` | The power/weighted Voronoi diagram, which is a peer dependency of the above |
| `d3-hierarchy` | Hierarchy math, never touching the DOM |
| `d3-zoom` | The viewport transform for Canvas pan/zoom |
| `d3-quadtree` | Hit-testing and viewport culling |
| `polylabel` | Label placement |

Installing these doesn't free the `d3` meta-package, which stays until `OpeningTreeFull` goes.

## Performance targets

| Area | Target | Approach |
|---|---|---|
| Visible polygons | Thousands | Canvas fill + stroke, with quadtree culling |
| Hit-testing | O(log n) | `d3-quadtree` |
| Voronoi relaxation | Never repeated client-side for the top levels | Precomputed and cached server-side |
| Lazy expansion | O(children) per expansion | Local relaxation inside the parent cell |
| Visible node count | Set by the user | Semantic-zoom threshold, not a hard cap |
