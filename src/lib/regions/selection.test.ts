import { describe, expect, it } from "vitest";
import { EXPLORER_MOVES_LIMIT, gameCount } from "@/lib/chess/explorerData";
import type { ExplorerMove } from "@/types/chess";
import { mulberry32 } from "./prng";
import {
  DEFAULT_TOP_SETTINGS,
  TIER_2_K,
  TIER_COUNT,
  byGamesThenUci,
  selectChildren,
  tierLimits,
} from "./selection";

const mv = (uci: string, games: number): ExplorerMove => ({ san: uci, uci, white: games, draws: 0, black: 0 });
const ucis = (moves: ExplorerMove[]) => moves.map((m) => m.uci);

// A start-position-like spread that sums to 3000 games.
const opening = [
  mv("e2e4", 1300),
  mv("d2d4", 1000),
  mv("g1f3", 300),
  mv("c2c4", 200),
  mv("g2g3", 100),
  mv("b2b3", 50),
  mv("f2f4", 25),
  mv("b1c3", 15),
  mv("e2e3", 5),
  mv("b2b4", 5),
];

describe("tierLimits", () => {
  it("gives 0.9, 0.99, 0.999 and 8, 15, 20 with the defaults", () => {
    const limits = [1, 2, 3].map((t) => tierLimits(t, DEFAULT_TOP_SETTINGS));
    expect(limits.map((l) => l.p)).toEqual([0.9, expect.closeTo(0.99, 12), expect.closeTo(0.999, 12)]);
    expect(limits.map((l) => l.k)).toEqual([8, TIER_2_K, EXPLORER_MOVES_LIMIT]);
  });
});

describe("selectChildren tiers", () => {
  it("takes the smallest prefix that reaches p at each level", () => {
    const s = selectChildren(opening, undefined, 3, DEFAULT_TOP_SETTINGS);
    expect(s.total).toBe(3000);
    expect(s.levels.map((l) => ucis(l.moves))).toEqual([
      ["e2e4", "d2d4", "g1f3", "c2c4"],
      ["g2g3", "b2b3", "f2f4"],
      ["b1c3", "b2b4", "e2e3"],
    ]);
    expect(s.levels.map((l) => l.otherGames)).toEqual([200, 25, 0]);
    expect(s.canOpenOther).toBe(false);
  });

  it("opens only the levels asked for", () => {
    const s = selectChildren(opening, undefined, 1, DEFAULT_TOP_SETTINGS);
    expect(s.levels).toHaveLength(1);
    expect(s.canOpenOther).toBe(true);
  });

  it("caps the moves shown in all at each tier's k", () => {
    const flat = Array.from({ length: 20 }, (_, i) => mv(`a${String(i).padStart(2, "0")}a1`, 10));
    const s = selectChildren(flat, undefined, 3, DEFAULT_TOP_SETTINGS);
    expect(s.levels.map((l) => l.moves.length)).toEqual([8, 7, 5]);
    expect(s.levels.map((l) => l.otherGames)).toEqual([120, 50, 0]);
  });

  it("shows at least one move at every opened level", () => {
    const s = selectChildren([mv("a", 990), mv("b", 9), mv("c", 1)], undefined, 3, DEFAULT_TOP_SETTINGS);
    expect(s.levels.map((l) => ucis(l.moves))).toEqual([["a"], ["b"], ["c"]]);
  });
});

describe("selectChildren totals", () => {
  it("uses the explorer totals, so unlisted games stay in Other and can't be opened", () => {
    const totals = { white: 4000, draws: 0, black: 0 };
    const s = selectChildren(opening, totals, 3, DEFAULT_TOP_SETTINGS);
    expect(s.total).toBe(4000);
    expect(s.levels.flatMap((l) => l.moves)).toHaveLength(opening.length);
    // Every listed move fits in two levels, so a third would be empty and isn't made.
    expect(s.levels).toHaveLength(2);
    expect(s.levels[s.levels.length - 1].otherGames).toBe(1000);
    expect(s.canOpenOther).toBe(false);
  });

  it("falls back to the listed moves when totals are missing or too small", () => {
    expect(selectChildren(opening, undefined, 1, DEFAULT_TOP_SETTINGS).total).toBe(3000);
    expect(selectChildren(opening, { white: 10, draws: 0, black: 0 }, 1, DEFAULT_TOP_SETTINGS).total).toBe(3000);
  });

  it("drops moves with no games and breaks ties by UCI", () => {
    const s = selectChildren([mv("z", 5), mv("q", 0), mv("a", 5)], undefined, 1, { p: 1, k: 8 });
    expect(ucis(s.levels[0].moves)).toEqual(["a", "z"]);
  });
});

describe("selectChildren forced moves", () => {
  const small = [mv("a", 990), mv("b", 9), mv("c", 1)];

  it("shows a forced move at its level whatever p says", () => {
    const s = selectChildren(small, undefined, 1, DEFAULT_TOP_SETTINGS, new Map([["c", 0]]));
    expect(ucis(s.levels[0].moves)).toEqual(["a", "c"]);
    expect(s.levels[0].otherGames).toBe(9);
  });

  it("goes past k for forced moves", () => {
    const forced = new Map([["a", 0], ["b", 0], ["c", 0]]);
    const s = selectChildren(small, undefined, 1, { p: 0.9, k: 2 }, forced);
    expect(s.levels[0].moves).toHaveLength(3);
  });

  it("opens every level down to a forced move, which waits for its own level", () => {
    const s = selectChildren(small, undefined, 1, DEFAULT_TOP_SETTINGS, new Map([["c", 2]]));
    expect(s.levels.map((l) => ucis(l.moves))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("ignores forced moves that aren't in the list", () => {
    const s = selectChildren(small, undefined, 1, DEFAULT_TOP_SETTINGS, new Map([["x", 2]]));
    expect(s.levels).toHaveLength(1);
  });
});

describe("selectChildren invariants", () => {
  it("never repeats a move and keeps every level's Other consistent", () => {
    const rng = mulberry32(31);
    for (let run = 0; run < 500; run++) {
      const count = Math.floor(rng() * 21);
      const moves = Array.from({ length: count }, (_, i) => mv(`m${i}`, Math.floor(Math.pow(rng(), 3) * 1000)));
      const listed = moves.reduce((sum, m) => sum + gameCount(m), 0);
      const totals = rng() < 0.5 ? undefined : { white: listed + Math.floor(rng() * 500), draws: 0, black: 0 };
      const top = { p: 0.5 + rng() * 0.49, k: 2 + Math.floor(rng() * 11) };
      const forced = new Map<string, number>();
      for (const m of moves) if (rng() < 0.1) forced.set(m.uci, Math.floor(rng() * TIER_COUNT));
      const openLevels = 1 + Math.floor(rng() * TIER_COUNT);

      const s = selectChildren(moves, totals, openLevels, top, forced);
      const positive = moves.filter((m) => gameCount(m) > 0);

      const seen = new Set<string>();
      let shownGames = 0;
      s.levels.forEach((level, index) => {
        expect([...level.moves].sort(byGamesThenUci)).toEqual(level.moves);
        // A level opens only while moves are left, and shows one unless every move left is
        // forced deeper (a pin keeps the "Other" blobs above it open even when empty).
        if (index > 0) expect(positive.some((m) => !seen.has(m.uci))).toBe(true);
        const available = positive.filter((m) => !seen.has(m.uci) && !((forced.get(m.uci) ?? -1) > index));
        if (available.length > 0) expect(level.moves.length).toBeGreaterThan(0);
        for (const m of level.moves) {
          expect(seen.has(m.uci)).toBe(false);
          seen.add(m.uci);
          shownGames += gameCount(m);
        }
        expect(level.otherGames).toBe(s.total - shownGames);
        expect(level.otherGames).toBeGreaterThanOrEqual(0);
        for (const [uci, at] of forced) {
          if (gameCount(moves.find((m) => m.uci === uci)!) > 0 && at === index) {
            expect(ucis(level.moves)).toContain(uci);
          }
        }
      });
      for (const uci of seen) expect(positive.some((m) => m.uci === uci)).toBe(true);
    }
  });
});
