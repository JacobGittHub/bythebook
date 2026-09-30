// Random inputs shared by the region property tests. Test-only.
import { sampleCircle, type Polygon, type Vec } from "./geometry";
import type { Rng } from "./prng";

/** Convex hull, counter-clockwise (Andrew's monotone chain). */
export function convexHull(points: readonly Vec[]): Vec[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const half = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };

  return [...half(sorted), ...half([...sorted].reverse())];
}

function rotate(points: readonly Vec[], angle: number): Vec[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** A convex region from one of several families: circle, random hull, long rectangle, triangle. */
export function randomRegion(rng: Rng): Polygon {
  const kind = Math.floor(rng() * 4);

  if (kind === 0) return sampleCircle({ x: 0, y: 0 }, 1 / Math.sqrt(Math.PI), 128);

  if (kind === 1) {
    const count = 5 + Math.floor(rng() * 30);
    return convexHull(Array.from({ length: count }, () => ({ x: rng(), y: rng() })));
  }

  if (kind === 2) {
    const w = 1;
    const h = 0.1 + rng() * 0.9;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
    return rotate(corners, rng() * Math.PI);
  }

  // A triangle that isn't too flat.
  const angles = [0, 1, 2].map((i) => (i * 2 * Math.PI) / 3 + (rng() - 0.5) * 1.2);
  return angles.map((a) => ({ x: Math.cos(a), y: Math.sin(a) }));
}

/** Positive weights: flat, long-tailed, or dominated by the first few, like real move counts. */
export function randomWeights(rng: Rng, count: number): number[] {
  const kind = Math.floor(rng() * 3);
  return Array.from({ length: count }, (_, i) => {
    if (kind === 0) return 0.2 + rng();
    if (kind === 1) return 1 / Math.pow(i + 1, 1.5);
    return Math.pow(0.5, i) * (0.5 + rng());
  });
}
