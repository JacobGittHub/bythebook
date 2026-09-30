// Convex-polygon geometry for the region map. Every polygon here is convex with its vertices
// in counter-clockwise order, and every function is pure.

export type Vec = { readonly x: number; readonly y: number };

/** A convex polygon, vertices counter-clockwise. One or two vertices mean a point or segment. */
export type Polygon = readonly Vec[];

/** Maps a point from a child's local frame into its parent's: `s · p + (x, y)`. */
export type Similarity = { readonly s: number; readonly x: number; readonly y: number };

/** Relative tolerance for treating edges as zero-length or vertices as collinear. */
const REL_EPS = 1e-12;

export function applySimilarity(t: Similarity, p: Vec): Vec {
  return { x: t.s * p.x + t.x, y: t.s * p.y + t.y };
}

/** Signed area: positive for counter-clockwise vertices. */
export function polygonArea(poly: Polygon) {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

export function polygonPerimeter(poly: Polygon) {
  if (poly.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Largest bounding-box side, used to scale tolerances. */
function extent(poly: Polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** Area centroid, or the vertex mean when the polygon has no area (a point or segment). */
export function polygonCentroid(poly: Polygon): Vec {
  if (poly.length === 0) throw new RangeError("Empty polygon has no centroid");

  // Work relative to the first vertex for precision.
  const o = poly[0];
  let twice = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const ax = poly[i].x - o.x, ay = poly[i].y - o.y;
    const b = poly[(i + 1) % poly.length];
    const bx = b.x - o.x, by = b.y - o.y;
    const cross = ax * by - bx * ay;
    twice += cross;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }

  const size = extent(poly);
  if (Math.abs(twice) <= REL_EPS * size * size) {
    let mx = 0, my = 0;
    for (const p of poly) {
      mx += p.x;
      my += p.y;
    }
    return { x: mx / poly.length, y: my / poly.length };
  }

  return { x: o.x + cx / (3 * twice), y: o.y + cy / (3 * twice) };
}

/**
 * The polygon's long direction, from its second area moments about the centroid.
 * `angle` is the direction of greatest spread. `anisotropy` is 0 for a round shape and
 * approaches 1 for a needle.
 */
export function principalAxis(poly: Polygon) {
  const c = polygonCentroid(poly);
  let sxx = 0, syy = 0, sxy = 0;

  for (let i = 0; i < poly.length; i++) {
    const ax = poly[i].x - c.x, ay = poly[i].y - c.y;
    const b = poly[(i + 1) % poly.length];
    const bx = b.x - c.x, by = b.y - c.y;
    const cross = ax * by - bx * ay;
    sxx += cross * (ax * ax + ax * bx + bx * bx);
    syy += cross * (ay * ay + ay * by + by * by);
    sxy += cross * (ax * by + 2 * ax * ay + 2 * bx * by + bx * ay);
  }
  sxx /= 12;
  syy /= 12;
  sxy /= 24;

  const half = (sxx - syy) / 2;
  const spread = Math.hypot(half, sxy);
  const mean = (sxx + syy) / 2;

  return {
    angle: 0.5 * Math.atan2(2 * sxy, sxx - syy),
    anisotropy: mean > 0 ? spread / mean : 0,
  };
}

/**
 * Keeps the part of `poly` where `dot(p, n) <= t` (one Sutherland–Hodgman pass). The two
 * sides of a cut, `(n, t)` and `(-n, -t)`, compute identical crossing points, so the pieces
 * share their cut edge exactly.
 */
export function clipHalfPlane(poly: Polygon, n: Vec, t: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = a.x * n.x + a.y * n.y - t;
    const db = b.x * n.x + b.y * n.y - t;

    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const f = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
  }
  return out;
}

/**
 * Cuts `poly` with a line perpendicular to the unit vector `n` so that the piece on the low
 * side (`dot(p, n) <= t`) has `share` of the area. Binary search on the line's offset; the
 * area on the low side grows monotonically with it.
 */
export function cutAtShare(poly: Polygon, n: Vec, share: number) {
  const target = share * polygonArea(poly);
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) {
    const d = p.x * n.x + p.y * n.y;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }

  // The area error is at most the chord length times the interval, so this is far below
  // any tolerance that matters.
  const tolerance = (hi - lo) * 1e-15;
  for (let i = 0; i < 200 && hi - lo > tolerance; i++) {
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) break;
    if (polygonArea(clipHalfPlane(poly, n, mid)) < target) lo = mid;
    else hi = mid;
  }

  const t = (lo + hi) / 2;
  return {
    low: clipHalfPlane(poly, n, t),
    high: clipHalfPlane(poly, { x: -n.x, y: -n.y }, -t),
  };
}

/** Removes repeated and collinear vertices, which would give edges without a direction. */
export function simplifyConvex(poly: Polygon): Vec[] {
  const size = extent(poly);
  const minLen = REL_EPS * size;

  const distinct: Vec[] = [];
  for (const p of poly) {
    const last = distinct[distinct.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > minLen) distinct.push(p);
  }
  while (
    distinct.length > 1 &&
    Math.hypot(
      distinct[0].x - distinct[distinct.length - 1].x,
      distinct[0].y - distinct[distinct.length - 1].y,
    ) <= minLen
  ) {
    distinct.pop();
  }
  if (distinct.length < 3) return distinct;

  const minCross = REL_EPS * size * size;
  const out: Vec[] = [];
  for (let i = 0; i < distinct.length; i++) {
    const prev = distinct[(i - 1 + distinct.length) % distinct.length];
    const v = distinct[i];
    const next = distinct[(i + 1) % distinct.length];
    const cross = (v.x - prev.x) * (next.y - v.y) - (v.y - prev.y) * (next.x - v.x);
    if (cross > minCross) out.push(v);
  }
  return out.length >= 3 ? out : distinct;
}

/** Outward unit normal and offset of each non-degenerate edge: the polygon is `dot(p, n) <= c`. */
function edgeHalfPlanes(poly: Polygon) {
  const minLen = REL_EPS * extent(poly);
  const planes: { n: Vec; c: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len <= minLen) continue;
    const n = { x: ey / len, y: -ex / len };
    planes.push({ n, c: a.x * n.x + a.y * n.y });
  }
  return planes;
}

/** Moves every edge inward by `d`. Returns an empty array when nothing is left. */
export function insetConvex(poly: Polygon, d: number): Vec[] {
  if (d <= 0) return [...poly];
  let out: Vec[] = [...poly];
  for (const { n, c } of edgeHalfPlanes(poly)) {
    out = clipHalfPlane(out, n, c - d);
    if (out.length === 0) break;
  }
  return out;
}

/** Radius of the largest circle that fits inside the polygon. */
export function inradius(poly: Polygon) {
  const area = polygonArea(poly);
  if (poly.length < 3 || area <= 0) return 0;

  // No circle with more area than the polygon fits inside it.
  let lo = 0;
  let hi = Math.sqrt(area / Math.PI);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (insetConvex(poly, mid).length > 0) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function isConvex(poly: Polygon) {
  if (poly.length < 3) return true;
  const size = extent(poly);
  const minCross = -REL_EPS * 100 * size * size;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross < minCross) return false;
  }
  return polygonArea(poly) > 0;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec) {
  const ex = b.x - a.x, ey = b.y - a.y;
  const lenSq = ex * ex + ey * ey;
  const f = lenSq > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq)) : 0;
  return Math.hypot(p.x - (a.x + ex * f), p.y - (a.y + ey * f));
}

/** Distance from `p` to the polygon's boundary: negative inside, positive outside. */
export function signedDistance(poly: Polygon, p: Vec) {
  if (poly.length === 0) throw new RangeError("Empty polygon");

  let outside = Infinity;
  for (let i = 0; i < poly.length; i++) {
    outside = Math.min(outside, distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  if (poly.length < 3) return outside;

  let deepest = -Infinity;
  for (const { n, c } of edgeHalfPlanes(poly)) {
    deepest = Math.max(deepest, p.x * n.x + p.y * n.y - c);
  }
  return deepest <= 0 ? deepest : outside;
}

function projectOnto(poly: Polygon, n: Vec) {
  let min = Infinity, max = -Infinity;
  for (const p of poly) {
    const d = p.x * n.x + p.y * n.y;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
}

/**
 * True when the interiors of two convex polygons overlap by more than a rounding error.
 * Polygons that only touch, such as the two sides of one cut, don't overlap.
 */
export function convexOverlap(a: Polygon, b: Polygon) {
  const slack = 1e-9 * Math.max(extent(a), extent(b));

  // Separating axis test. Edge normals decide it for polygons; the centroid direction covers
  // points and segments, which have no edge normals of their own.
  const axes = [...edgeHalfPlanes(a), ...edgeHalfPlanes(b)].map((plane) => plane.n);
  const ca = polygonCentroid(a);
  const cb = polygonCentroid(b);
  const len = Math.hypot(cb.x - ca.x, cb.y - ca.y);
  if (len > 0) axes.push({ x: (cb.x - ca.x) / len, y: (cb.y - ca.y) / len });

  for (const n of axes) {
    const pa = projectOnto(a, n);
    const pb = projectOnto(b, n);
    if (pb.min >= pa.max - slack || pa.min >= pb.max - slack) return false;
  }
  return true;
}

/** The gap between two convex polygons, or 0 when they overlap. */
export function convexDistance(a: Polygon, b: Polygon) {
  if (convexOverlap(a, b)) return 0;

  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      best = Math.min(
        best,
        distanceToSegment(a[i], b[j], b[(j + 1) % b.length]),
        distanceToSegment(b[j], a[i], a[(i + 1) % a.length]),
      );
    }
  }
  return best;
}

/** A regular polygon inscribed in the circle, so it lies inside it. */
export function sampleCircle(center: Vec, radius: number, segments: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    out.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return out;
}
