import { describe, expect, it } from "vitest";
import {
  applySimilarity,
  inradius,
  polygonArea,
  signedDistance,
  type Polygon,
} from "./geometry";
import {
  pebbleArea,
  pebbleInterior,
  samplePebble,
  shapePebble,
  toLocalFrame,
  type Pebble,
} from "./pebble";
import { mulberry32 } from "./prng";
import { expectNoViolations, randomRegion } from "./testShapes";

const unitSquare: Polygon = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Depth of a point inside a pebble: its distance to the pebble's edge, negative outside. */
function depthInPebble(p: Pebble, v: { x: number; y: number }) {
  return p.r - signedDistance(p.core, v);
}

describe("pebbleArea", () => {
  it("covers discs, stadiums and rounded squares", () => {
    expect(pebbleArea({ core: [{ x: 0, y: 0 }], r: 2 })).toBeCloseTo(4 * Math.PI, 12);
    const segment = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(pebbleArea({ core: segment, r: 1 })).toBeCloseTo(6 + Math.PI, 12);
    expect(pebbleArea({ core: unitSquare, r: 0.5 })).toBeCloseTo(1 + 2 + Math.PI / 4, 12);
  });
});

describe("samplePebble", () => {
  it("puts every point on the true outline, and approaches the true area", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const core = randomRegion(rng);
      const r = rng() * 0.3;
      const outline = samplePebble(core, r, 512);
      for (const v of outline) expect(Math.abs(depthInPebble({ core, r }, v))).toBeLessThan(1e-12);

      const exact = pebbleArea({ core, r });
      expect(polygonArea(outline)).toBeLessThanOrEqual(exact);
      expect(polygonArea(outline) / exact).toBeGreaterThan(1 - 1e-3);
    }
  });
});

describe("pebbleInterior", () => {
  it("keeps every point at least the inset away from the edge", () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 100; i++) {
      const core = randomRegion(rng);
      const pebble = { core, r: rng() * 0.2 };
      const inset = rng() * 0.3;
      const interior = pebbleInterior(pebble, inset, 128);
      if (!interior) continue;
      for (const v of interior) expect(depthInPebble(pebble, v)).toBeGreaterThan(inset - 1e-12);
    }
  });

  it("is empty when the inset swallows the pebble", () => {
    expect(pebbleInterior({ core: unitSquare, r: 0.1 }, 0.7, 128)).toBeNull();
    expect(pebbleInterior({ core: [{ x: 0, y: 0 }], r: 1 }, 1, 128)).toBeNull();
  });
});

describe("shapePebble", () => {
  const options = { siblingGap: 0.02, roundness: 0.15 };

  it("stays half its gap inside its cell, and keeps the full gap in roomy cells", () => {
    const rng = mulberry32(5);
    // Gathered and asserted once: an expect per vertex is slow (plans/testing.md, D4).
    const wrong: string[] = [];
    for (let i = 0; i < 200; i++) {
      // Scale the cell down so some cells are too thin for the gap.
      const scale = Math.pow(10, -2 * rng());
      const cell = randomRegion(rng).map((v) => ({ x: v.x * scale, y: v.y * scale }));
      const { pebble, gap } = shapePebble(cell, options);

      if (pebble.core.length === 0) wrong.push(`run ${i}: empty core`);
      if (gap > options.siblingGap) wrong.push(`run ${i}: gap ${gap} is over the sibling gap`);
      if (inradius(cell) >= options.siblingGap && gap !== options.siblingGap) {
        wrong.push(`run ${i}: a roomy cell got gap ${gap}`);
      }
      for (const v of pebble.core) {
        const depth = -signedDistance(cell, v);
        if (!(depth > gap / 2 + pebble.r - 1e-12)) wrong.push(`run ${i}: a core vertex is only ${depth} inside`);
      }
    }
    expectNoViolations(wrong);
  });
});

describe("toLocalFrame", () => {
  it("scales to area 1 and maps back exactly", () => {
    const pebble = { core: unitSquare.map((v) => ({ x: 3 + 0.2 * v.x, y: -1 + 0.2 * v.y })), r: 0.05 };
    const { local, toParent } = toLocalFrame(pebble);
    expect(pebbleArea(local)).toBeCloseTo(1, 12);
    local.core.forEach((v, i) => {
      const back = applySimilarity(toParent, v);
      expect(back.x).toBeCloseTo(pebble.core[i].x, 12);
      expect(back.y).toBeCloseTo(pebble.core[i].y, 12);
    });
    expect(local.r * toParent.s).toBeCloseTo(pebble.r, 12);
  });
});
