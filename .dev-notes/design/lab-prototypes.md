# Lab prototypes

**Status:** These are exploratory prototypes. They are **not** the production direction, but
they are retained deliberately, and the user may revisit the 3D globe in particular. Don't
build production work on them. They are not deletion candidates (see "Kept on purpose" in
`AGENTS.md`).
**Last reviewed:** 2026-09-29
**Files:** `src/app/dashboard/lab/page.tsx` (the lab harness, with tabs "Globe (R3F)" and
"2D Map"), `src/components/lab/GlobeTest.tsx`, `src/components/lab/ChessMap.tsx`

A third tab, "Regions", is being built. It has its own doc: `region-map.md`.

## Rules

- **The production-visualization rules don't apply here.** Those are the containment
  invariant, the ban on force-directed layouts, and the ban on wedges (see `architecture.md`
  § "Visualization principles"). The globe's sphere layout and ChessMap's angular layout are
  valid within the lab.
- **Nothing flows the other way.** Lab code isn't a foundation for production components.
  Globe-specific functions (`layoutRecursive`, `computeBuildOrder`, `AnimatedNodes`) don't
  transfer to Voronoi or Möbius geometry. The only genuinely shared piece is
  `buildDefaultCatalogTree()`.
- **Three.js and React Three Fiber stay in the lab.** Never use them in the explorer, the
  dashboard tree or the candidate visualizations.

---

## 3D globe (`GlobeTest.tsx`)

A slowly rotating 3D globe of opening positions. It uses React Three Fiber, drei helpers
(`OrbitControls` with auto-rotate, `Html`, `Stats`, `AdaptiveDpr`) and `three`. A production
`OpeningGlobe.tsx` has never been created.

**Data sources (`config.dataSource`)**

- `"synthetic"` builds a tree algorithmically with `buildTree()` or
  `buildSyntheticMoveTree()`.
- `"eco"` builds from `buildDefaultCatalogTree()`.

**Pipeline**

1. **Layout (`config.layout`).** Either `"fibonacci"`, which places nodes on a Fibonacci
   sphere grouped by depth shell, or `"recursive"` (`layoutRecursive()`), which places each
   parent's children in an outward cone.
2. **Cap.** Nodes are capped at `config.nodeCount`. The DFS order guarantees that parents
   come before children, so slicing is safe.
3. **Weights.** `postProcessWeights()` sets `weight` to the **subtree size** (self plus all
   descendants). The comment on `TreeNode.weight` says "direct child count", but that is
   stale; the function computes subtree size. When `scaleByWeight` is on, node size and edge
   width both scale from it.
4. **Build order.** `computeBuildOrder()` schedules the build animation round-robin over the
   root's children. `buildAnimPriority` moves it from BFS toward DFS, and `engineBias` gives
   larger subtrees more timeslices.
5. **Rendering.**
   - Edges are drawn as variable-width `LineSegments2` + `LineMaterial` ("ThickEdges").
   - Nodes are individual meshes (`AnimatedNodes`).
   - `Html` labels are shown only below `MAX_LABEL_NODES`.

**Performance**

- **Draw calls are the bottleneck.** Individual node meshes cost one draw call each, which
  holds 60 fps up to roughly 100–150 nodes.
- **`InstancedMesh` is the single biggest possible optimization.** It makes one draw call
  regardless of node count (10,000+ at 60 fps) by writing position, scale and color to
  `instanceMatrix` and `instanceColor` each frame. Entry animations still work.
- **Html labels cost one DOM element each,** which is why they are capped.

**Intended interaction (from design mockups, not fully built)**

- **Hover.** Hovering shows a pointer cursor and a white torus ring that tracks the node as
  the globe rotates, with a move-path label above it. The sidebar fills in progressively with
  the board, engine eval, ECO name and master W/D/L. Leaving the node clears all of this.
- **Click to re-root.**
  1. A pink arc sweeps from the clicked node to the center.
  2. The path from the original root to the clicked node lights up yellow (the ancestor
     trail) and stays lit.
  3. The tree re-lays itself out from the clicked node, and labels become relative to the
     new root.
  4. Clicking a node on the ancestor trail pops back to that depth.
  
  A history stack tracks the re-roots, and there is no URL change.
- **Node states.** Book nodes are emerald, catalog-only nodes muted blue, the ancestor trail
  yellow, and the current root the center sphere.
- **Edges.** Width shows popularity. In future, dashed edges would mean a significant eval
  drop and a warm tint would mean frequently failed in drills.
- **Possible additions:**
  - `@react-spring/three` (about 15 KB), if the floaty idle motion needs true springs rather
    than the current sinusoidal orbit.
  - A physics engine is **not** justified.

---

## Book branch view (`BookBranchView`, unbuilt)

A possible future view that was never created. Whether to render it in 2D (React Flow,
`@xyflow/react`) or 3D (React Three Fiber) is undecided and doesn't block anything, since the
territory map candidate covers the repertoire-planning job this view was meant for. The 3D
look was preferred, with React Flow as a low-graphics fallback. React Flow is reserved for
this view only.

**Two sub-modes**

1. **Opening book branch view**, entered from the globe.
   - It shows the user's whole book with sidelines at every node (master continuations from
     `position_cache`), plus the subtrees of earlier paths so the user can judge coverage.
   - **Color** is a heat map of success rate from `user_position_stats`: unvisited is pale,
     frequently failed is warm.
   - **Size and edge brightness** follow the games at each position.
   - Unused branches fade out over time, as an animated prune with undo.
   - Future idea: pale nodes and faded edges for positions never reached, with a toggle for
     what counts as "reached" (imported PGNs, drills, or both). Edges between differently
     colored nodes would blend between the two endpoint colors.
2. **Branch expansion view.**
   - It follows one line to a depth of up to 25 moves.
   - Edge length is a fixed constant (`BRANCH_STEP`), so deep lines extend far from the
     center, and the camera follows.
   - It shows no earlier-path subtrees, since those clutter at depth 25.
   - A breadcrumb or depth indicator shows the distance from the root.

**Shared rules for both sub-modes**

- **Edges.** Dark and thick for the book's main line, regular for explored sidelines, and
  dashed for significant eval drops (from `position_evals`) or unsound moves surfaced by
  drills.
- **Physics.** Spring-based idle movement.

**The transition from the globe** would animate the radial layout into the branch layout,
turned to face right and zoomed to fill the viewport, using Framer Motion or an R3F camera
animation.

**Degrading gracefully.**

- `position_evals` is empty, so no dashed edges appear until evals exist.
- New users have no `user_position_stats`, so every node is treated as unvisited (pale).

---

## 2D map (`ChessMap.tsx`)

A popularity-weighted recursive angular tree drawn with the Canvas 2D API only (no D3, R3F or
SVG), with pan and zoom via `ctx.setTransform`. It is deterministic: the same data always
gives the same layout. It has a fixed root at the start position and doesn't re-root. Its
angular-sector approach is what the territory map candidate would supersede for production;
the prototype itself stays.

**Layout (as implemented)**

- **Weight** is the subtree node count (`buildWeightMap`).
- **Root spokes.**
  - The major first moves are auto-detected by the largest relative weight gap
    (`detectMajorCount`) and spaced evenly around the circle, with **e4 pinned to north**.
  - The minor first moves are distributed round-robin into the gaps between major spokes.
- **Children.**
  - Children are sorted by weight. The heaviest is centered on the parent's direction and
    the rest alternate left and right, each taking a share of the parent's sector
    proportional to its weight.
  - Sectors are a spreading guide, not hard walls; depth decay keeps branches from straying
    far. This means the layout does **not** strictly satisfy containment.
- **Retrograde branching.** Less popular, lower-ranked children are bent back toward the
  parent's reverse direction (`retrogradeStrength`). This fills interior space and gives a
  root-system look.
- **Branch length** is `baseBranchLength × depthDecay^(depth×1.5)`, scaled by popularity.
  **Line width** scales with weight relative to the global maximum.
- **Level of detail.** The threshold is the weight of the `maxNodes`-th heaviest node,
  divided by the zoom scale, so deeper nodes appear as you zoom in.
- **Ghost lines.** Leaf nodes draw a short, faint dashed extension to show that the line
  continues past the loaded depth.

**Rendering.** A dirty flag plus a `requestAnimationFrame` loop redraw only when the
transform or layout changes. The layout is memoized per config.

**Background layers**

1. **Built:** a hue-wheel conic gradient at about 8.5% opacity, anchored to the root's screen
   position.
2. **Planned (Phase 2):** a themed "blob" layer. These are purely decorative illustrated
   objects that scale with zoom depth like "Scale of the Universe". They would be
   LOD-culled like Google Maps tiles, with positions seeded by a hash of the tile coordinates
   so they stay stable. Zoom levels overlap, so there are no sharp transitions, and sector
   edges bleed slightly into their neighbors.
3. **Built:** the tree itself, with branch lines and node dots on top.

**Blob themes (Phase 2 idea).** These were originally tied to fixed first-move angles:
e4=N, d4=S, c4=E, Nf3=W, f4=NE, g3=NW, b3=SE, Nc3=SW. The current layout pins only e4 and
spaces the other majors evenly, so re-map the themes to spokes if this is built.

| Opening | Theme | Scale progression |
|---|---|---|
| e4 | Ocean | Waves → coral → fish → whales → deep sea → hadal monsters |
| d4 | City | Skyline → streets → subway → offices → people → rats → bacteria |
| Nf3 | Space | Galaxy → black hole → stars → planets → asteroids → remnants |
| c4 | Jungle | Canopy → undergrowth → floor → roots → insects → spores → microbes |
| f4 | Volcanic | Eruption → lava → magma → tectonic → mineral → crystal → atomic |
| g3 | Mountain | Range → peaks → cliff → boulders → stone → mineral → crystal |
| b3 | Sky/Weather | Front → storm → cloud → droplets → molecules → atoms |
| Nc3 | Medieval castle | Kingdom → castle → great hall → armory → weapons → steel grain |
| French | Underground cave | Cave → cavern → stalactites → crystals → lattice → atomic |
| Berlin | Arctic | Ice shelf → glacier → snowflakes → ice crystals → H₂O → H-bonds |
| Catalan | Botanical garden | Garden → flowers → petals → pollen → cells → chloroplasts → DNA |
| London | Railroad/industrial | Rail network → station → locomotive → pistons → steel → iron atom |
| Deep theory | Quantum | Electrons → nucleus → quarks → gluons → quantum foam → strings |

**Data phases**

- **Phase 1 (built):** the ECO catalog tree only.
- **Phase 3 (idea):** call the Lichess masters API lazily when zoom approaches a leaf. Sectors
  for unloaded children would be pre-allocated from weight estimates, so zooming never shifts
  the layout. New nodes would be added to the layout cache incrementally.
