import { describe, expect, it } from "vitest";
import { PAGE_BORDER } from "./layout";
import { MAX_RIFFLES, riffleBookmarkX, turnBetween } from "./turns";

describe("turnBetween", () => {
  it("turns forward to a later chapter and back to an earlier one", () => {
    expect(turnBetween(1, 2)).toEqual({ way: "forward", riffled: [] });
    expect(turnBetween(2, 1)).toEqual({ way: "back", riffled: [] });
  });

  it("never turns within a chapter, or into or out of the book", () => {
    expect(turnBetween(3, 3)).toBeNull();
    expect(turnBetween(-1, 2)).toBeNull();
    expect(turnBetween(2, -1)).toBeNull();
  });

  it("riffles the leaves between, in the order they turn", () => {
    expect(turnBetween(0, 3)).toEqual({ way: "forward", riffled: [1, 2] });
    expect(turnBetween(4, 0)).toEqual({ way: "back", riffled: [3, 2, 1] });
  });

  it("riffles at most MAX_RIFFLES leaves, spread from the jump's start to its end", () => {
    for (let from = 0; from < 12; from++) {
      for (let to = 0; to < 12; to++) {
        const turn = turnBetween(from, to);
        if (!turn) continue;
        const between = Math.abs(to - from) - 1;
        expect(turn.riffled).toHaveLength(Math.min(MAX_RIFFLES, between));
        // Each riffled chapter lies between the two, once, in the turn's order.
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        turn.riffled.forEach((c, i) => {
          expect(c).toBeGreaterThan(lo);
          expect(c).toBeLessThan(hi);
          if (i > 0) expect(turn.way === "forward" ? c > turn.riffled[i - 1] : c < turn.riffled[i - 1]).toBe(true);
        });
        if (between > MAX_RIFFLES) {
          expect(turn.riffled[0]).toBe(from + (turn.way === "forward" ? 1 : -1));
          expect(turn.riffled.at(-1)).toBe(to - (turn.way === "forward" ? 1 : -1));
        }
      }
    }
  });
});

describe("riffleBookmarkX", () => {
  const leftWidth = 600;

  it("keeps a bookmark that lies on the leaf's own side", () => {
    expect(riffleBookmarkX({ side: "right", x: 120 }, "right", leftWidth)).toBe(120);
    expect(riffleBookmarkX({ side: "left", x: 120 }, "left", leftWidth)).toBe(120);
  });

  it("mirrors one on the other page over the spine, so it lands where it lies", () => {
    // On the left page, 80px in from the spine: on a right-hand leaf, 80px from the spine too.
    const x = leftWidth - PAGE_BORDER - 80;
    expect(riffleBookmarkX({ side: "left", x }, "right", leftWidth)).toBe(80);
    expect(riffleBookmarkX({ side: "right", x: 80 }, "left", leftWidth)).toBe(x);
  });
});
