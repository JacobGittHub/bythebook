import { describe, expect, it } from "vitest";
import { PAGE_BORDER } from "./layout";
import {
  MAX_RIFFLES,
  RIFFLE_STEP_MS,
  TURN_MS,
  ZOOM_MS,
  ZOOM_OVERLAP,
  ZOOM_TURN_MS,
  moveBetween,
  moveTiming,
  riffleBookmarkX,
  turnBetween,
  type Place,
} from "./turns";

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

describe("moveBetween", () => {
  const library: Place = { at: 3, level: 1 };
  const libraryBook: Place = { at: 3, level: 2 };

  it("turns forward down to a second level and back up from it, zooming in and out in the spread (D8)", () => {
    expect(moveBetween(library, libraryBook, "spread")).toEqual({ way: "forward", riffled: [], zoom: "in" });
    expect(moveBetween(libraryBook, library, "spread")).toEqual({ way: "back", riffled: [], zoom: "out" });
  });

  it("never zooms in the one-page form (D15)", () => {
    expect(moveBetween(library, libraryBook, "single")).toEqual({ way: "forward", riffled: [], zoom: null });
    expect(moveBetween({ at: 1, level: 2 }, { at: 5, level: 2 }, "single")?.zoom).toBeNull();
  });

  it("turns between chapters as ever, zooming out of a second level or across to another", () => {
    expect(moveBetween({ at: 0, level: 1 }, { at: 3, level: 1 }, "spread")).toEqual({ way: "forward", riffled: [1, 2], zoom: null });
    expect(moveBetween(libraryBook, { at: 1, level: 1 }, "spread")).toEqual({ way: "back", riffled: [2], zoom: "out" });
    expect(moveBetween({ at: 0, level: 1 }, { at: 2, level: 2 }, "spread")?.zoom).toBe("in");
    expect(moveBetween(libraryBook, { at: 4, level: 2 }, "spread")?.zoom).toBe("across");
  });

  it("turns down to a whole spread's second level without zooming", () => {
    const history: Place = { at: 3, level: 2, zoomed: false };
    expect(moveBetween(library, history, "spread")).toEqual({ way: "forward", riffled: [], zoom: null });
    expect(moveBetween(history, { at: 1, level: 1 }, "spread")?.zoom).toBeNull();
    expect(moveBetween(history, { at: 4, level: 2 }, "spread")?.zoom).toBe("in");
  });

  it("doesn't turn for another page of the same level, or outside the book (D13)", () => {
    expect(moveBetween(libraryBook, libraryBook, "spread")).toBeNull();
    expect(moveBetween(library, library, "spread")).toBeNull();
    expect(moveBetween({ at: -1, level: 1 }, { at: -1, level: 2 }, "spread")).toBeNull();
  });
});

describe("moveTiming", () => {
  it("turns first going in and starts the zoom ZOOM_OVERLAP into the turn (D8)", () => {
    const t = moveTiming({ way: "forward", riffled: [], zoom: "in" });
    expect(t).toEqual({ turn: ZOOM_TURN_MS, turnStart: 0, turnEnd: ZOOM_TURN_MS, zoomStart: ZOOM_OVERLAP * ZOOM_TURN_MS, zoomEnd: ZOOM_OVERLAP * ZOOM_TURN_MS + ZOOM_MS });
  });

  it("zooms out first and starts the turn ZOOM_OVERLAP into the zoom, riffles and all", () => {
    const t = moveTiming({ way: "back", riffled: [2, 1], zoom: "out" });
    const turnLength = ZOOM_TURN_MS + 2 * RIFFLE_STEP_MS;
    const turnStart = ZOOM_OVERLAP * ZOOM_MS;
    expect(t).toEqual({ turn: ZOOM_TURN_MS, turnStart, turnEnd: turnStart + turnLength, zoomStart: 0, zoomEnd: ZOOM_MS });
  });

  it("overlaps the zoom and the turn whenever both run, and runs a plain turn at its own speed", () => {
    for (const zoom of ["in", "out", "across"] as const) {
      const t = moveTiming({ way: "forward", riffled: [1], zoom });
      expect(t.turnStart).toBeLessThan(t.zoomEnd);
      expect(t.zoomStart).toBeLessThan(t.turnEnd);
    }
    expect(moveTiming({ way: "forward", riffled: [], zoom: null })).toMatchObject({ turn: TURN_MS, turnStart: 0, turnEnd: TURN_MS });
  });
});
