import { describe, expect, it } from "vitest";
import type { WeightedItem } from "./bisect";
import { applySimilarity, convexDistance, signedDistance } from "./geometry";
import {
  DEFAULT_LAYOUT_OPTIONS,
  ROOT_PEBBLE,
  layoutChildren,
  wallInset,
  type LayoutOptions,
} from "./layout";
import { pebbleArea, type Pebble } from "./pebble";
import { mulberry32, rngFor, type Rng } from "./prng";
import { expectNoViolations, randomWeights } from "./testShapes";

function itemsFrom(weights: number[]): WeightedItem[] {
  return weights.map((weight, i) => ({ id: `m${i}`, weight }));
}

function randomOptions(rng: Rng): LayoutOptions {
  return {
    siblingGap: rng() * 0.05,
    wallGap: rng() * 0.08,
    roundness: rng() * 0.3,
    jitter: rng() * (Math.PI / 4),
  };
}

/** A parent to lay out in: the root, or a child or grandchild of it in its own local frame. */
function randomParent(rng: Rng): Pebble {
  let parent = ROOT_PEBBLE;
  const depth = Math.floor(rng() * 3);
  for (let d = 0; d < depth; d++) {
    const items = itemsFrom(randomWeights(rng, 2 + Math.floor(rng() * 8)));
    const children = layoutChildren(parent, items, rng, DEFAULT_LAYOUT_OPTIONS)!;
    const pick = [...children.values()][Math.floor(rng() * children.size)];
    parent = pick.local;
  }
  return parent;
}

describe("layoutChildren invariants", () => {
  it("keeps siblings apart, children inside the wall, and every local frame at area 1", () => {
    const rng = mulberry32(21);
    // Gathered and asserted once: an expect per vertex made this test slow enough to time out.
    const wrong: string[] = [];
    for (let run = 0; run < 150; run++) {
      const parent = randomParent(rng);
      const options = run % 3 === 0 ? DEFAULT_LAYOUT_OPTIONS : randomOptions(rng);
      const items = itemsFrom(randomWeights(rng, 1 + Math.floor(rng() * 20)));
      const children = layoutChildren(parent, items, rng, options);
      if (!children) {
        wrong.push(`run ${run}: no layout`);
        continue;
      }

      const list = [...children.entries()];
      for (const [id, child] of list) {
        // Distance from the child to the parent's wall, measured at the child's core corners.
        for (const v of child.pebble.core) {
          const depth = parent.r - signedDistance(parent.core, v) - child.pebble.r;
          if (!(depth > wallInset(options) + child.gap / 2 - 1e-9)) {
            wrong.push(`run ${run}: "${id}" is ${depth} inside the wall`);
          }
        }

        // As toBeCloseTo(1, 9) would check it.
        const area = pebbleArea(child.local);
        if (!(Math.abs(area - 1) < 5e-10)) wrong.push(`run ${run}: "${id}" has local area ${area}`);
        child.local.core.forEach((v, i) => {
          const back = applySimilarity(child.toParent, v);
          const off = Math.hypot(back.x - child.pebble.core[i].x, back.y - child.pebble.core[i].y);
          if (!(off < 1e-12)) wrong.push(`run ${run}: "${id}" vertex ${i} maps back ${off} off`);
        });
      }

      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [aId, a] = list[i];
          const [bId, b] = list[j];
          const gap = convexDistance(a.pebble.core, b.pebble.core) - a.pebble.r - b.pebble.r;
          if (!(gap > (a.gap + b.gap) / 2 - 1e-9)) wrong.push(`run ${run}: "${aId}" and "${bId}" are ${gap} apart`);
        }
      }
    }
    expectNoViolations(wrong);
  });

  it("keeps the full gaps with the defaults and typical move counts", () => {
    const items = itemsFrom([45, 30, 12, 6, 4, 2, 1]);
    const children = layoutChildren(ROOT_PEBBLE, items, rngFor("", 0), DEFAULT_LAYOUT_OPTIONS)!;
    for (const child of children.values()) expect(child.gap).toBe(DEFAULT_LAYOUT_OPTIONS.siblingGap);
  });
});

describe("layoutChildren determinism", () => {
  const items = itemsFrom([45, 30, 12, 6, 4, 2, 1]);

  it("gives deep-equal output for the same seed", () => {
    expect(layoutChildren(ROOT_PEBBLE, items, rngFor("e2e4", 0), DEFAULT_LAYOUT_OPTIONS)).toEqual(
      layoutChildren(ROOT_PEBBLE, items, rngFor("e2e4", 0), DEFAULT_LAYOUT_OPTIONS),
    );
  });

  it("gives a different arrangement for a different salt", () => {
    const a = layoutChildren(ROOT_PEBBLE, items, rngFor("e2e4", 0), DEFAULT_LAYOUT_OPTIONS)!;
    const b = layoutChildren(ROOT_PEBBLE, items, rngFor("e2e4", 1), DEFAULT_LAYOUT_OPTIONS)!;
    const moved = items.some((item) => {
      const ta = a.get(item.id)!.toParent;
      const tb = b.get(item.id)!.toParent;
      return Math.hypot(ta.x - tb.x, ta.y - tb.y) > 0.01;
    });
    expect(moved).toBe(true);
  });
});

describe("layoutChildren without room", () => {
  it("returns null when the wall gap leaves no space", () => {
    const options = { ...DEFAULT_LAYOUT_OPTIONS, wallGap: 1 };
    expect(layoutChildren(ROOT_PEBBLE, itemsFrom([1, 2]), mulberry32(1), options)).toBeNull();
  });
});
