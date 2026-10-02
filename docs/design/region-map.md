# Region map (lab prototype)

**Status:** A third prototype on the Visualizations page, "Regions", next to "Globe (R3F)"
and "2D Map" (see `lab-prototypes.md` for how the prototypes are shown). The map itself
works: it lays out, zooms, pans and opens "Other". Focus, pinning and the sidebar controls
are not built yet, and the sections on them below describe the design, not the code. It is
the first hands-on prototype of the territory-map idea (`territory-map.md`) and tests that
doc's layout questions. It is exempt from the production visualization rules like the other
lab prototypes, but it is built to them anyway: containment, pure layout functions and
property tests.
**Last reviewed:** 2026-10-02
**Files:** `src/lib/regions/` holds the pure logic, with `*.test.ts` alongside and shared test
inputs in `testShapes.ts`: `prng`, `geometry`, `bisect`, `pebble`, `layout` (which composes
bisection and pebbles for one parent), `selection`, `loader`, `store` (the blob tree),
`camera`, `visibility` (what to draw) and `labels`. The view is
`src/components/lab/RegionMap.tsx`, which draws with `src/components/lab/regionRender.ts`.
Planned: `windows` (focus) and `pins`.

The design below was settled with the user on 2026-09-29. The values given as defaults are
design decisions. Once they exist in code, replace them here with the names of their
constants.

## Build progress

The remaining build phases and their checks are tracked in `plans/region-map.md`.

## What it shows

- **The root is a circle standing for all of chess.** It is split into regions ("blobs"),
  one per White first move. Each blob is split the same way into the replies to that move,
  and so on down the tree.
- **Blob area follows a size function.** Popularity (Lichess masters game counts) is the only
  one built for now. Engine evaluation comes later.
- **Blobs are rounded convex pebbles.** Siblings are separated by a gap and kept away from the
  parent's wall by padding. Other shapes, such as clouds, may come later.

## Layout: balanced bisection

1. Split the children into two groups of roughly equal total weight: sort by weight, largest
   first (ties by id), and add each to the lighter group.
2. Cut the region with a straight line across its longest direction (its principal axis from
   second area moments), tilted by a random jitter (`DEFAULT_LAYOUT_OPTIONS.jitter` in
   `layout.ts`). Binary search finds the cut position whose piece areas exactly match the
   two groups' shares. A nearly round region has no real long axis, so below
   `ROUND_REGION_ANISOTROPY` (`bisect.ts`) the tilt widens toward a fully random direction;
   otherwise the root circle would always be cut the same way.
3. Randomly decide which group goes on which side, then recurse into both pieces until each
   child has its own cell.
4. Round each cell into a pebble with padding. Cut lines are never drawn.

- **Every piece is convex,** because a straight cut through a convex region always gives
  convex pieces. That makes padding, rounding and hit-testing simple and exact.
- **Rejected: peeling one child off at a time** (top-1 against the rest, then top-2 against
  the rest). A straight cut that takes a small share off a round region leaves a thin cap:
  a 5% cut off a circle is about six times wider than it is tall. After padding it
  collapses.
- **Rejected: Voronoi treemap.** It has no padding, its areas only converge approximately, and
  pinning inside it is very hard.
- **Rejected: circle packing.** It leaves too much empty space. The user wants no-gap pebbles
  apart from the padding.

**Randomness is seeded.** The seed is a hash of each blob's move sequence plus a "Reshuffle"
salt (`cyrb53`, then `mulberry32`).
- The same settings always give the same map, which serves memorability and makes tests
  reproducible.
- Every blob has its own seed, so the biggest child points in a different direction in each
  parent.
- The Reshuffle button changes the salt, which re-rolls every blob that isn't pinned.

**Padding is relative to the parent.** The sibling gap, wall gap and corner roundness are
fractions of the parent's size, so zooming into any blob looks like the top level. Their
defaults are `DEFAULT_LAYOUT_OPTIONS` (`layout.ts`).
- Each child keeps half the sibling gap inside its own cell. The wall gap is the distance from
  the parent's wall to its children, so it can't be less than half the sibling gap.
- In a thin cell the corner radius shrinks first, then the gap (`MAX_RADIUS_SHARE` and
  `MAX_HALF_GAP_SHARE` in `pebble.ts`). Each child records the gap it kept, and the tests
  check the gaps against those.
- Shrinking a pebble inward is exact. For a core polygon C with corner radius r, shrinking by
  g ≤ r gives C plus a disc of radius r − g. Shrinking by g > r gives C shrunk by g − r.
- The rounded region for children is turned into a polygon for cutting by taking one point
  on the outline per direction (`INTERIOR_SEGMENTS` per turn). Every point is on the true
  outline, so the polygon lies inside it, and its vertex count stays fixed instead of
  growing with depth.

## Coordinates and precision

- **Each blob's geometry is stored in its parent's local frame.** It is a convex core polygon,
  a corner radius, and a similarity transform `toParent = {s, x, y}`.
- **A blob's own frame is centred on its core's centroid and scaled so the pebble has area
  1.** Every level therefore works with numbers around 1. The root (`ROOT_PEBBLE`) is a disc
  of area 1.
- **The camera uses a floating origin,** `{anchorId, k, tx, ty}` (`camera.ts`). It re-anchors
  to the frame blob whenever the frame changes, and screen points must not move when it does
  (this is tested).
- **Transforms are composed outward from the anchor,** up through ancestors and down into
  subtrees, never down from the root. This keeps deep zoom precise without a tile system.
  `frameToFrame` goes between two blobs through their nearest common ancestor, and
  `buildScene` (`visibility.ts`) works outward from the camera's anchor.

## The blob tree

`createRegionStore` in `store.ts` holds the blobs the view draws.

- **It starts as the root alone and grows.** The view hands it explorer data for a blob
  (`expand`), and it lays out that blob's children. Clicking "Other" lays out the next tier
  inside it (`reveal`).
- **A blob's id is its path from the root:** UCI moves and "Other" segments (`OTHER_SEGMENT`)
  joined by spaces. The id seeds the blob's layout, so the same settings and data give the
  same map in whatever order blobs are expanded (tested).
- **A blob's status says what can happen to it** (`BlobStatus`): open, split, leaf, wall, or
  for an "Other", closed or sealed.
- **New settings mean a new store.** The settings (`RegionSettings`) are top p and k, the
  layout options, the Reshuffle salt and the max zoom depth.

## Which children a blob gets: top p, top k and "Other"

`selectChildren` in `selection.ts` implements this.

- **Order:** moves sorted by games, most first (ties by UCI). Moves with no games are dropped.
- **Tier 1:** take the smallest prefix whose games reach p of the position's total, capped at
  k moves (`DEFAULT_TOP_SETTINGS`: 0.9 and 8). Everything else becomes one dashed **"Other"**
  blob, whose area is the position total minus the selected moves.
- **The total is the explorer's position total,** so "Other" includes moves beyond the 20
  Lichess lists. Old cache rows without totals fall back to the sum of the listed moves.
- **Clicking "Other" reveals the next tier inside it,** so nothing else on the map moves. A
  smaller "Other" remains if moves are left.
  - Tier t covers share p of what tier t − 1 left over, so its cumulative cut-off is
    1 − (1 − p)^t. With p = 0.9 that is 0.9, 0.99 and 0.999, as the user described ("p .9 of
    the .9"), and it still holds when the sidebar changes p.
  - k: tier 2 allows `TIER_2_K` moves in all, and tier 3 everything the explorer returns
    (`EXPLORER_MOVES_LIMIT`).
  - There are `TIER_COUNT` tiers. After the last, what remains is permanently sealed.
  - Opening "Other" always reveals at least one move, even if the next tier's p is already
    met. An "Other" whose remaining games belong only to unlisted moves is sealed, since
    opening it would show nothing.
- **p and k are cumulative totals for the parent** (confirmed with the user). Tier 2 shows at
  most 15 moves in all, not 15 more than tier 1.
- **"Other" doesn't count as a layer.** The moves inside it have the same side to move as
  their siblings, so they have the same colour and depth.
- **Pinned moves, and moves on the path to a pin, are always included.** They appear at the
  tier level they were pinned in, whatever p and k say, and keep every "Other" above them
  open, even one left with nothing else in it.
- **Changing p or k re-lays out the whole map** behind a spinner.

## Zoom model

`buildScene` in `visibility.ts` implements this, apart from focus.

- **Max zoom depth** (`DEFAULT_MAX_DEPTH` plies): blobs can be subdivided up to that many
  layers below the root or below any focus above them.
- **Display depth** (`DEFAULT_DISPLAY_DEPTH`): blobs are drawn down to the frame blob's depth
  plus the display depth, and only on screen.
- **Frame blob:** the deepest blob covering at least `FRAME_COVERAGE` of the viewport, with
  the root as the fallback.
  - The frame is unique because siblings never overlap, so at most one can cover more than
    half the screen. Below 50%, two siblings could qualify.
  - Blobs under a minimum pixel size are neither computed nor drawn (`MIN_DRAW_PX`, and
    `MIN_SUBDIVIDE_PX` for subdividing).
- **The layer fade.** The next layer fades in inside a blob as that blob's coverage rises
  from 0% to 50%, so nothing pops when the frame changes (tested).
  - Each blob has a budget of layers it may show below itself. The root's is the display
    depth. A child's is its parent's, less one, plus the child's own openness (its coverage
    as a share of `FRAME_COVERAGE`, at most 1), capped at the display depth. A blob's
    opacity is its parent's budget, clamped to 0–1.
  - The frame and everything above it therefore keep the full budget, and the layer past
    the display depth appears only inside the children being zoomed into.
  - This replaces the first wording of the rule, "the next layer fades in as the leading
    child's coverage rises", which fades one layer by one number. That version pops: the
    moment a child becomes the frame, the layer below its own leading child appears at
    once. With the budget, more than one extra layer can be partly visible down a line of
    main moves, each fainter than the last.
- **Wall:** a blob that can't be subdivided because of the depth limit is drawn with diagonal
  hatching. When it's large on screen it will also say "Click to focus and go deeper" (with
  focus).
  - You can zoom past a wall, but nothing new appears.
  - Zoom-in is blocked when none of the frame's children are in view and the viewport,
    grown by `SEALED_ZOOM_ALLOWANCE`, fits inside the frame. That covers a sealed frame
    (the designed rule: 2× past the point where it fills the screen), and also the empty
    padding between a frame's children, where zooming on would show nothing and wear out
    the camera's precision.
  - Zoom-out stops when the root is `MIN_ROOT_SHARE` of the viewport's smaller dimension.

## Focus and chains

- **Clicking a blob focuses it.** It gets a hardened look (thicker edge and a glow), gains 10
  more subdividable layers below it, and becomes a home base for the camera. Focusing never
  turns a blob into the root.
- **Focuses form chains.** The interface allows one chain; the model stores a set of focuses
  so the future atlas can hold many.
  - Focusing inside the chain's deepest focus extends the chain.
  - Focusing inside an earlier link cuts the chain back to that link and extends it from
    there.
  - Focusing anywhere else starts a new chain.
  - Clicking a focused blob unfocuses it.
- **Corridor:** the path from the root to any focus is always open. Path blobs beyond the
  root's range show one layer of children, and the off-path children are sealed. This
  matters mainly when a middle link is unfocused.
- **Focus implies pin.** A focus that moved would lose the user's place.

## Pinning

- **Shift+click pins or unpins a blob.** A pinned blob has a double edge.
- **Pins are relative to the parent.** A pinned blob keeps its area share and its placement
  within its parent. Its children, siblings and ancestors still refresh on Reshuffle, p or k
  changes, or a size-function change. If an ancestor moves, the pinned blob moves with it.
- **A pin remembers the size function it was made with** and keeps that tint, while
  everything around it follows the current size function.
- **When the parent is re-laid out:**
  - **Fit:** if the stored pinned cell still lies inside the parent's new interior, it is kept
    exactly.
    - The free space splits into convex pieces along the lines of the pinned cell's interior
      edges.
    - Unpinned siblings are assigned to those pieces by a small search that minimises the
      largest share error, and each piece is bisected.
    - With several pins, they are subtracted one after another.
  - **Carve:** otherwise, a piece with the same area share is carved in the same direction
    from the parent's centroid, and the rest is bisected.
- **The stored pin is never overwritten,** so the exact shape returns if the parent's shape
  does.
- **Consequence:** changing p usually reshapes every unpinned ancestor, so after a p change a
  pinned blob usually keeps its share and direction rather than its exact outline. To keep a
  blob completely still, pin its ancestors too.
- **Siblings' sizes become approximate** around a pin. The largest share error is shown in
  the stats.

## Colour and style

- **By side to move:** blobs for White's moves have a white edge and a faint white fill.
  Blobs for Black's moves have a black edge and a faint black fill.
- **Size-function tint,** mixed into edge and fill: popularity is cream-brown, and engine
  (not built yet) is green.
- **Background:** a neutral mid tone, so both white and black edges read.
- **Stroke width** is heavier for layers closer to the frame.
- **Special styles:**
  - Focused: thicker, with a glow.
  - Pinned: a double edge.
  - "Other": dashed.
  - Wall: hatched.
  - Waiting for data: a dotted outline.
- **Labels:** SAN at the core centroid, sized to the blob, with a toggle (the toggle comes
  with the sidebar). Opening names come later. `placeLabels` in `labels.ts` decides them.
  - A blob much larger than the reading size (`READING_SIZE_SHARE` of the viewport) carries
    its label as a faint watermark.
  - A move that most games continue with sits in the middle of its parent, so their labels
    land on each other. Of a blob and an ancestor whose labels overlap, the one nearer the
    reading size keeps its label and the other gives way. They trade places gradually as
    the view zooms, so nothing pops (tested).
- **In code:** the colours and line styles are the constants at the top of
  `regionRender.ts`.

## Data

- **One explorer lookup per blob, for its own position,** through `/api/openings/explorer`
  (see `processes/lichess-api-and-caching.md`).
- **The route returns up to `EXPLORER_MOVES_LIMIT` moves and the position totals.** Old cache
  rows are refetched lazily. The Explorer page, mini tree and dashboard tree still show 12
  (`EXPLORER_DISPLAY_MOVES`). The process doc has the details.
- **Child positions** come from `fenAfterUci` in `src/lib/chess/fen.ts`.
- **The client loader** (`createExplorerLoader` in `loader.ts`):
  - At most `EXPLORER_MAX_IN_FLIGHT` requests open, each position requested once.
  - The view calls `want()` with the positions it needs and their on-screen sizes. That
    replaces the waiting queue, so positions scrolled away are dropped, and the biggest load
    first.
  - A 429 pauses every request for its `Retry-After`, and the rate-limited position goes
    first when the pause ends. Other failures wait `FAILED_RETRY_MS` before being asked
    again.
  - `dispose()` aborts open requests on unmount. Loaded data sits in a cache that lasts for
    the page session, so switching tabs and back doesn't reload it.
- **Master games thin out** past about 15 plies in sidelines, so many branches end before the
  depth limit.

## Interaction

- **Pan and zoom:** wheel zoom toward the cursor, drag to pan (with a click threshold,
  `CLICK_THRESHOLD_PX`), and two-finger pinch. A trackpad pinch arrives as a wheel event
  with Ctrl held and zooms too.
- **Clicks:** click focuses, Shift+click pins, and clicking "Other" reveals it. Only the
  "Other" click is built so far; `hitTest` finds the deepest drawn blob under the pointer.
- **Buttons:** "Fit" and "Zoom to focus" animate with d3's `interpolateZoom`.
- **The pointer handling is written by hand, not with `d3-zoom`,** because `d3-zoom` holds the
  wheel gesture's world point in the old frame, so re-anchoring mid-gesture would jump.

## Lab integration

- **Views:** each prototype is a view of `LabHarness` on its own page, so only one is
  mounted at a time. `RegionMap` cleans up its animation frame, `ResizeObserver`, listeners,
  retry timer and loader on unmount.
- **One effect, no re-renders.** `RegionMap` keeps the store, camera and scene outside React.
  Its animation loop redraws only when something changed (a dirty flag), and spends at most
  `LAYOUT_BUDGET_MS` a frame laying out blobs, so a burst of loaded positions doesn't stall
  the view.
- **Loading:** a shared `LabSpinner` covers each view's first load. `RegionMap` shows a spinner
  overlay during the first layout, and will during any full re-layout.
- **Stats:** they live in a `LabStats` component that owns the refresh timer, so only the
  stats panel re-renders.
  - Globe: renderer stats.
  - 2D Map: FPS and nodes drawn.
  - Regions: FPS, blobs drawn, frame depth, layout time and pending requests. The largest
    share error comes with pinning.
- **Sidebar:**
  - Settings that re-lay out the map: top p, top k, sibling gap, wall gap, roundness, cut
    jitter, and Reshuffle.
  - Size function: Popularity, with Engine disabled for now.
  - Display-only settings: max zoom depth, display depth, and labels.
  - Actions: Clear focus and pins, and Fit.

## Tests (property tests, over seeded random inputs)

- **Bisection:** cell areas match the weight shares to within 1e-9 relative. Cells are
  pairwise disjoint, together make up the whole region, and are all convex.
- **Padding:** sibling pebbles are at least the sibling gap apart, and every pebble is at least
  the wall gap inside its parent, less only what a thin cell had to give up. With the defaults
  and a typical spread of moves, nothing is given up.
- **Seeds:** the same seed gives deep-equal output, and a different salt gives a different
  arrangement.
- **Selection:** the tiers work, the totals are used, and pins override the cutoffs.
- **Camera:** re-anchoring leaves screen points fixed to within 1e-9.
- **Store:** every blob lies inside its parent, the geometry doesn't depend on the order of
  expansion, opening "Other" moves nothing else, and walls, leaves and sealed "Other"s stay
  as they are.
- **Scene:** the frame is the deepest blob covering half the viewport, each blob is listed
  after its parent and placed where the camera puts it, and opacity changes only slightly
  for a slight move of the camera, including across a change of frame.
- **Labels:** a blob's label and an ancestor's never both stay strong where they overlap.
- **Focus:** the window, corridor and chain rules.
- **Pins:** a pin that fits keeps its geometry exactly, and the carve fallback keeps its area
  share.

## Later (not in this build)

- The engine-evaluation size function, and its green tint.
- Opening-name labels.
- Other blob shapes, such as clouds or textures.
- Multiple chains, leading to the **atlas**: a separate display with a pre-generated, pinned
  map. Its shapes would depend on the engine search depth or the current popularity counts.
