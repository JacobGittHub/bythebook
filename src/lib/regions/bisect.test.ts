import { describe, expect, it } from "vitest";
import { bisect, type WeightedItem } from "./bisect";
import {
  convexOverlap,
  isConvex,
  polygonArea,
  polygonCentroid,
  sampleCircle,
  signedDistance,
} from "./geometry";
import { mulberry32, rngFor } from "./prng";
import { randomRegion, randomWeights } from "./testShapes";

const JITTER = (25 * Math.PI) / 180;
const circle = sampleCircle({ x: 0, y: 0 }, 1 / Math.sqrt(Math.PI), 128);

function itemsFrom(weights: number[]): WeightedItem[] {
  return weights.map((weight, i) => ({ id: `m${i}`, weight }));
}

describe("bisect invariants", () => {
  it("gives convex, disjoint cells that fill the region with exact area shares", () => {
    const rng = mulberry32(11);
    for (let run = 0; run < 300; run++) {
      const region = randomRegion(rng);
      const items = itemsFrom(randomWeights(rng, 1 + Math.floor(rng() * 20)));
      const cells = bisect(region, items, rng, { jitter: rng() * (Math.PI / 4) });

      const total = polygonArea(region);
      const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
      let areaSum = 0;

      expect([...cells.keys()]).toEqual(items.map((item) => item.id));
      for (const item of items) {
        const cell = cells.get(item.id)!;
        const area = polygonArea(cell);
        areaSum += area;
        expect(isConvex(cell)).toBe(true);
        expect(Math.abs(area / total - item.weight / weightSum)).toBeLessThan(1e-9);
        for (const v of cell) expect(signedDistance(region, v)).toBeLessThan(1e-9);
      }
      expect(Math.abs(areaSum / total - 1)).toBeLessThan(1e-9);

      const list = [...cells.values()];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(convexOverlap(list[i], list[j])).toBe(false);
        }
      }
    }
  });
});

describe("bisect randomness", () => {
  const items = itemsFrom([45, 30, 12, 6, 4, 2, 1]);

  it("gives identical cells for the same seed", () => {
    expect(bisect(circle, items, rngFor("e2e4", 0), { jitter: JITTER })).toEqual(
      bisect(circle, items, rngFor("e2e4", 0), { jitter: JITTER }),
    );
  });

  it("gives a different arrangement for a different salt", () => {
    const a = bisect(circle, items, rngFor("e2e4", 0), { jitter: JITTER });
    const b = bisect(circle, items, rngFor("e2e4", 1), { jitter: JITTER });
    const moved = items.some((item) => {
      const ca = polygonCentroid(a.get(item.id)!);
      const cb = polygonCentroid(b.get(item.id)!);
      return Math.hypot(ca.x - cb.x, ca.y - cb.y) > 0.01;
    });
    expect(moved).toBe(true);
  });

  it("points the largest child in every direction across different parents", () => {
    const quadrants = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const cells = bisect(circle, items, rngFor(`parent${i}`, 0), { jitter: JITTER });
      const c = polygonCentroid(cells.get("m0")!);
      quadrants.add((c.x >= 0 ? 0 : 1) + (c.y >= 0 ? 0 : 2));
    }
    expect(quadrants.size).toBe(4);
  });
});

describe("bisect edge cases", () => {
  it("gives a single item the whole region", () => {
    const cells = bisect(circle, itemsFrom([3]), mulberry32(1), { jitter: JITTER });
    expect(cells.get("m0")).toBe(circle);
  });

  it("returns nothing for no items", () => {
    expect(bisect(circle, [], mulberry32(1), { jitter: JITTER }).size).toBe(0);
  });

  it("rejects bad weights and duplicate ids", () => {
    const rng = mulberry32(1);
    expect(() => bisect(circle, itemsFrom([1, 0]), rng, { jitter: JITTER })).toThrow(RangeError);
    expect(() => bisect(circle, itemsFrom([1, NaN]), rng, { jitter: JITTER })).toThrow(RangeError);
    expect(() =>
      bisect(circle, [{ id: "a", weight: 1 }, { id: "a", weight: 2 }], rng, { jitter: JITTER }),
    ).toThrow(RangeError);
  });
});
