import { describe, expect, it } from "vitest";
import {
  clipHalfPlane,
  convexDistance,
  convexOverlap,
  cutAtShare,
  inradius,
  insetConvex,
  isConvex,
  polygonArea,
  polygonCentroid,
  principalAxis,
  sampleCircle,
  signedDistance,
  simplifyConvex,
  type Polygon,
  type Vec,
} from "./geometry";
import { mulberry32 } from "./prng";
import { expectNoViolations, randomRegion } from "./testShapes";

const square = (x: number, y: number, size: number): Polygon => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];

/** Smallest difference between two line directions, which repeat every π. */
function axisDifference(a: number, b: number) {
  const d = (((a - b) % Math.PI) + Math.PI) % Math.PI;
  return Math.min(d, Math.PI - d);
}

describe("area and centroid", () => {
  it("gives signed area by orientation", () => {
    expect(polygonArea(square(0, 0, 1))).toBeCloseTo(1, 15);
    expect(polygonArea([...square(0, 0, 1)].reverse())).toBeCloseTo(-1, 15);
  });

  it("finds the centroid, falling back to the vertex mean without area", () => {
    const c = polygonCentroid(square(2, 3, 2));
    expect(c.x).toBeCloseTo(3, 12);
    expect(c.y).toBeCloseTo(4, 12);
    expect(polygonCentroid([{ x: 1, y: 2 }])).toEqual({ x: 1, y: 2 });
    expect(polygonCentroid([{ x: 0, y: 0 }, { x: 2, y: 0 }])).toEqual({ x: 1, y: 0 });
  });
});

describe("principalAxis", () => {
  it("points along a rectangle's long side", () => {
    for (const angle of [0, 0.4, 1.3, 2.9]) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const rect = [
        { x: -2, y: -0.5 },
        { x: 2, y: -0.5 },
        { x: 2, y: 0.5 },
        { x: -2, y: 0.5 },
      ].map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
      const axis = principalAxis(rect);
      expect(axisDifference(axis.angle, angle)).toBeLessThan(1e-9);
      expect(axis.anisotropy).toBeGreaterThan(0.8);
    }
  });

  it("finds no preferred direction in a circle", () => {
    expect(principalAxis(sampleCircle({ x: 3, y: -1 }, 2, 128)).anisotropy).toBeLessThan(1e-9);
  });
});

describe("clipping and cutting", () => {
  it("clips a square to a half-plane", () => {
    const left = clipHalfPlane(square(0, 0, 1), { x: 1, y: 0 }, 0.25);
    expect(polygonArea(left)).toBeCloseTo(0.25, 15);
  });

  it("cuts any region at any share, into convex pieces that fill it exactly", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 300; i++) {
      const region = randomRegion(rng);
      const angle = rng() * 2 * Math.PI;
      const share = 0.001 + rng() * 0.998;
      const { low, high } = cutAtShare(region, { x: Math.cos(angle), y: Math.sin(angle) }, share);
      const total = polygonArea(region);

      expect(Math.abs(polygonArea(low) / total - share)).toBeLessThan(1e-12);
      expect(Math.abs((polygonArea(low) + polygonArea(high)) / total - 1)).toBeLessThan(1e-12);
      expect(isConvex(low) && isConvex(high)).toBe(true);
      expect(convexOverlap(low, high)).toBe(false);
    }
  });
});

describe("insetConvex and inradius", () => {
  it("moves every edge inward", () => {
    expect(polygonArea(insetConvex(square(0, 0, 1), 0.1))).toBeCloseTo(0.64, 12);
    expect(insetConvex(square(0, 0, 1), 0.6)).toEqual([]);
  });

  it("finds the largest inscribed circle", () => {
    expect(inradius(square(0, 0, 1))).toBeCloseTo(0.5, 12);
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: Math.sqrt(3) / 2 },
    ];
    expect(inradius(triangle)).toBeCloseTo(Math.sqrt(3) / 6, 12);
    expect(inradius(sampleCircle({ x: 0, y: 0 }, 1, 64))).toBeCloseTo(Math.cos(Math.PI / 64), 12);
  });

  it("leaves every inset vertex at least the inset from the boundary", () => {
    const rng = mulberry32(2);
    // Gathered and asserted once: an expect per vertex is slow (plans/testing.md, D4).
    const wrong: string[] = [];
    for (let i = 0; i < 200; i++) {
      const region = randomRegion(rng);
      const d = rng() * inradius(region);
      for (const v of insetConvex(region, d)) {
        const distance = signedDistance(region, v);
        if (!(distance < -d + 1e-12)) wrong.push(`run ${i}: a vertex is ${-distance} in, not ${d}`);
      }
    }
    expectNoViolations(wrong);
  });
});

describe("distances", () => {
  it("measures signed distance to the boundary", () => {
    expect(signedDistance(square(0, 0, 1), { x: 0.5, y: 0.5 })).toBeCloseTo(-0.5, 15);
    expect(signedDistance(square(0, 0, 1), { x: 2, y: 0.5 })).toBeCloseTo(1, 15);
    expect(signedDistance([{ x: 0, y: 0 }], { x: 3, y: 4 })).toBeCloseTo(5, 15);
  });

  it("tells touching, overlapping and separate polygons apart", () => {
    const a = square(0, 0, 1);
    expect(convexOverlap(a, square(1, 0, 1))).toBe(false);
    expect(convexDistance(a, square(1, 0, 1))).toBeCloseTo(0, 12);
    expect(convexOverlap(a, square(0.5, 0.5, 1))).toBe(true);
    expect(convexDistance(a, square(0.5, 0.5, 1))).toBe(0);
    expect(convexDistance(a, square(1.3, 0, 1))).toBeCloseTo(0.3, 12);
    expect(convexDistance(a, square(2, 2, 1))).toBeCloseTo(Math.SQRT2, 12);
  });

  it("handles points and segments", () => {
    const p: Vec[] = [{ x: 0, y: 0 }];
    const q: Vec[] = [{ x: 3, y: 4 }];
    expect(convexOverlap(p, q)).toBe(false);
    expect(convexDistance(p, q)).toBeCloseTo(5, 12);
    expect(convexOverlap([{ x: 0.5, y: 0.5 }], square(0, 0, 1))).toBe(true);
  });
});

describe("simplifyConvex", () => {
  it("drops repeated and collinear vertices", () => {
    const messy = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ];
    expect(simplifyConvex(messy)).toEqual(square(0, 0, 1));
  });
});
