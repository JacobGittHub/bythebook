# Hyperbolic companion panel

**Status:** This is the leading candidate for the explorer sidebar, but it is **not
settled**. Nothing has been built yet (`src/components/hyperbolic/` doesn't exist). Don't
start building it, or shape other work toward it, unless the user asks.
**Would replace:** the tree window in the explorer sidebar, which shows the book views (see `explorer.md`)

Read `architecture.md` § "Visualization principles" first.

## Rules (for when it is built)

- **Render to SVG, never Canvas.** The visible node count is bounded at a couple of hundred,
  so SVG's free hit-testing, CSS-transitionable animation and crisp arcs are worth having.
- **No force-directed or spring layouts, and no Three.js.**
- **Keep it separate from the territory map.** They share the data layer only.
- **It doesn't replace the board-based Explorer.** It sits beside the board.

## Job

This is a small companion panel beside the board during **live exploration of a line**. It
is not a planning surface; planning is the territory map's job.

## Model

- **A hyperbolic tree in the Poincaré disk,** following Lamping and Rao's focus-plus-context
  technique. Hyperbolic space grows exponentially with radius and the opening tree branches
  exponentially, so the two cancel. Unlimited depth fits inside a fixed-size disk, and the
  panel therefore never resizes and never needs to zoom out.
- **This is the designed answer to depth.** The territory map handles breadth; this panel
  handles depth.

## Navigation

- **Navigating is a Möbius transformation** that translates hyperbolic space. It glides the
  focus node to the center while ancestors and abandoned lines compress smoothly toward the
  rim.
- **About 50–200 nodes are visible at any moment:** the current line sharp at the center, and
  the surrounding tree still legible at the edge.

## Engine bias

- **Engine evaluation biases child ordering within each parent's angular wedge.** Lines that
  favor White rotate toward the wedge's upward side, which gives the consistent reading "up
  and outward means my position improves."
- **The bias is deliberately local.** Mapping evaluation to a global vertical axis would
  break containment.
- **Without evals, the ordering is unbiased,** so the panel degrades gracefully.

## Data

```
OpeningExplorer (still owns all fetching)
  ├─ moveHistory / the current line          board state, already available
  ├─ explorerMoves + historyAlternates       via position_cache, already available
  └─ position_evals                          ordering bias (the table is empty today)
```

## Implementation

- **Hand-rolled, at roughly 200 lines of complex arithmetic.** No maintained hyperbolic
  layout library exists, so don't spend time searching for one.
- **It suits test-driven implementation,** because its correctness conditions are assertions
  rather than judgments:
  - Möbius isometries preserve hyperbolic distance.
  - A transformation composed with its inverse is the identity, within floating-point
    tolerance.
- **The pipeline:**
  1. Allocate an angular wedge per parent (containment-preserving).
  2. Apply the local eval rotation within each wedge.
  3. Apply the Möbius translation to center the focus node.
  4. Project from the Poincaré disk to SVG coordinates.
- **Performance.** The Möbius transformation is O(visible) per frame, which is trivial at
  this node count. No culling is needed, because distant nodes shrink below visibility by
  construction.
