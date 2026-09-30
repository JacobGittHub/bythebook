import {
  inradius,
  insetConvex,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
  simplifyConvex,
  type Polygon,
  type Similarity,
  type Vec,
} from "./geometry";

/** A rounded convex region: every point within `r` of the convex polygon `core`. */
export type Pebble = { readonly core: Polygon; readonly r: number };

export type PebbleOptions = {
  /** Gap between neighbouring siblings, in the parent's local units. */
  siblingGap: number;
  /** Corner radius as a fraction of √(cell area). */
  roundness: number;
};

/** Half the sibling gap takes at most this share of a cell's inradius; thin cells keep less. */
const MAX_HALF_GAP_SHARE = 0.5;
/** The corner radius takes at most this share of the inradius left after the gap. */
const MAX_RADIUS_SHARE = 0.8;

/** Area of a pebble (Steiner's formula for a convex set grown by a disc). */
export function pebbleArea(p: Pebble) {
  const coreArea = p.core.length >= 3 ? polygonArea(p.core) : 0;
  return coreArea + polygonPerimeter(p.core) * p.r + Math.PI * p.r * p.r;
}

/** One rounded corner: a core vertex and the angles its arc spans, increasing. */
export type Arc = {
  readonly x: number;
  readonly y: number;
  readonly start: number;
  readonly end: number;
};

/**
 * The corner arcs of a pebble outline. The outline is these arcs, each of radius `r`, joined
 * by straight edges parallel to the core's edges.
 */
export function pebbleArcs(core: Polygon): Arc[] {
  if (core.length === 1) return [{ x: core[0].x, y: core[0].y, start: 0, end: 2 * Math.PI }];

  const arcs: Arc[] = [];
  for (let i = 0; i < core.length; i++) {
    const prev = core[(i - 1 + core.length) % core.length];
    const v = core[i];
    const next = core[(i + 1) % core.length];
    const e0 = { x: v.x - prev.x, y: v.y - prev.y };
    const e1 = { x: next.x - v.x, y: next.y - v.y };

    // Swing from the incoming edge's outward normal to the outgoing edge's.
    const start = Math.atan2(-e0.x, e0.y);
    const turn = Math.max(0, Math.atan2(e0.x * e1.y - e0.y * e1.x, e0.x * e1.x + e0.y * e1.y));
    arcs.push({ x: v.x, y: v.y, start, end: start + turn });
  }
  return arcs;
}

/**
 * The outline of `core` grown by `radius`, as a convex polygon of at most `segmentsPerTurn`
 * points: for each of that many evenly spaced directions, the outline's farthest point that
 * way. Every point is on the true outline, so the polygon lies inside the true shape, and its
 * size doesn't grow with the core's vertex count (which would compound level after level).
 */
export function samplePebble(core: Polygon, radius: number, segmentsPerTurn: number): Vec[] {
  if (radius <= 0) return simplifyConvex(core);

  const reach = (i: number, dx: number, dy: number) => core[i].x * dx + core[i].y * dy;

  // The core vertex farthest in direction +x; it then moves forward as the direction turns.
  let support = 0;
  for (let i = 1; i < core.length; i++) {
    if (reach(i, 1, 0) > reach(support, 1, 0)) support = i;
  }

  const out: Vec[] = [];
  for (let k = 0; k < segmentsPerTurn; k++) {
    const angle = (2 * Math.PI * k) / segmentsPerTurn;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let steps = 0; steps < core.length; steps++) {
      const next = (support + 1) % core.length;
      if (reach(next, dx, dy) <= reach(support, dx, dy)) break;
      support = next;
    }
    out.push({ x: core[support].x + radius * dx, y: core[support].y + radius * dy });
  }
  return simplifyConvex(out);
}

/**
 * The pebble shrunk inward by `inset`, as a convex polygon, or null when nothing with area
 * is left. Exact apart from arc sampling: with a core C and radius r, shrinking by
 * `inset <= r` gives C grown by `r - inset`, and shrinking by more gives C shrunk by
 * `inset - r`.
 */
export function pebbleInterior(p: Pebble, inset: number, segmentsPerTurn: number): Polygon | null {
  const outline =
    inset <= p.r
      ? samplePebble(p.core, p.r - inset, segmentsPerTurn)
      : simplifyConvex(insetConvex(p.core, inset - p.r));
  return outline.length >= 3 && polygonArea(outline) > 0 ? outline : null;
}

export type ShapedPebble = {
  readonly pebble: Pebble;
  /** The sibling gap this pebble kept. A thin cell keeps less than asked. */
  readonly gap: number;
};

/**
 * Rounds a bisection cell into a pebble that keeps half the sibling gap inside the cell.
 * When the cell is too thin, the corner radius shrinks first, then the gap.
 */
export function shapePebble(cell: Polygon, options: PebbleOptions): ShapedPebble {
  const rin = inradius(cell);
  const halfGap = Math.min(options.siblingGap / 2, MAX_HALF_GAP_SHARE * rin);
  const r = Math.max(
    0,
    Math.min(options.roundness * Math.sqrt(polygonArea(cell)), MAX_RADIUS_SHARE * (rin - halfGap)),
  );
  const core = simplifyConvex(insetConvex(cell, halfGap + r));

  // Only a cell without area gets here.
  if (core.length === 0) return { pebble: { core: [polygonCentroid(cell)], r: 0 }, gap: 0 };

  return { pebble: { core, r }, gap: 2 * halfGap };
}

/**
 * Re-expresses a pebble in its own local frame: centred on its core's centroid and scaled
 * to area 1. `toParent` maps local points back.
 */
export function toLocalFrame(p: Pebble): { local: Pebble; toParent: Similarity } {
  const c = polygonCentroid(p.core);
  const s = Math.sqrt(pebbleArea(p));
  return {
    local: {
      core: p.core.map((v) => ({ x: (v.x - c.x) / s, y: (v.y - c.y) / s })),
      r: p.r / s,
    },
    toParent: { s, x: c.x, y: c.y },
  };
}
