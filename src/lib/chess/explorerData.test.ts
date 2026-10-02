import { describe, expect, it } from "vitest";
import type { ExplorerMove, ExplorerResponse } from "@/types/chess";
import {
  EXPLORER_DISPLAY_MOVES,
  EXPLORER_MOVES_LIMIT,
  forDisplay,
  gameCount,
  isCacheEntryCurrent,
  normalizeCastling,
  summarizeMasterGames,
} from "./explorerData";

const move = (uci: string, games = 10): ExplorerMove => ({ san: uci, uci, white: games, draws: 0, black: 0 });

describe("normalizeCastling", () => {
  it("rewrites king-to-rook castling and leaves other moves alone", () => {
    const data = normalizeCastling({ moves: [move("e1h1"), move("e8a8"), move("e2e4")] });
    expect(data.moves.map((m) => m.uci)).toEqual(["e1g1", "e8c8", "e2e4"]);
  });
});

describe("isCacheEntryCurrent", () => {
  const totals = { white: 1, draws: 1, black: 1 };

  it("accepts rows with totals and the current move limit", () => {
    expect(isCacheEntryCurrent({ moves: [], totals, movesLimit: EXPLORER_MOVES_LIMIT })).toBe(true);
  });

  it("rejects rows cached by older code", () => {
    expect(isCacheEntryCurrent({ moves: [] })).toBe(false);
    expect(isCacheEntryCurrent({ moves: [], totals })).toBe(false);
    expect(isCacheEntryCurrent({ moves: [], totals, movesLimit: 12 })).toBe(false);
    expect(isCacheEntryCurrent({ moves: [], movesLimit: EXPLORER_MOVES_LIMIT })).toBe(false);
  });
});

describe("forDisplay", () => {
  it("keeps the first moves the existing UI shows, and everything else", () => {
    const data: ExplorerResponse = {
      moves: Array.from({ length: 20 }, (_, i) => move(`m${i}`)),
      opening: { eco: "A00", name: "Test" },
      totals: { white: 200, draws: 0, black: 0 },
    };
    const trimmed = forDisplay(data);
    expect(trimmed.moves).toEqual(data.moves.slice(0, EXPLORER_DISPLAY_MOVES));
    expect(trimmed.opening).toEqual(data.opening);
    expect(data.moves).toHaveLength(20);
  });
});

describe("gameCount", () => {
  it("adds wins, draws and losses", () => {
    expect(gameCount({ white: 3, draws: 4, black: 5 })).toBe(12);
  });
});

describe("summarizeMasterGames", () => {
  const moves: ExplorerMove[] = [
    { san: "e4", uci: "e2e4", white: 30, draws: 20, black: 10 },
    { san: "d4", uci: "d2d4", white: 10, draws: 20, black: 10 },
  ];

  it("adds up the listed moves when there are no totals", () => {
    const summary = summarizeMasterGames(moves);
    expect(summary.games).toBe(100);
    expect([summary.whitePct, summary.drawPct, summary.blackPct]).toEqual([40, 40, 20]);
    expect(summary.moves.map((m) => [m.san, m.games, m.pct])).toEqual([
      ["e4", 60, 60],
      ["d4", 40, 40],
    ]);
  });

  it("measures against the totals when given them, which count unlisted moves too", () => {
    const summary = summarizeMasterGames(moves, { white: 100, draws: 60, black: 40 });
    expect(summary.games).toBe(200);
    expect([summary.whitePct, summary.drawPct, summary.blackPct]).toEqual([50, 30, 20]);
    expect(summary.moves.map((m) => m.pct)).toEqual([30, 20]);
  });

  it("gives percentages that add up to 100, and zeros for a position with no games", () => {
    const thirds = summarizeMasterGames([], { white: 1, draws: 1, black: 1 });
    expect(thirds.whitePct + thirds.drawPct + thirds.blackPct).toBe(100);

    expect(summarizeMasterGames([])).toMatchObject({ games: 0, whitePct: 0, drawPct: 0, blackPct: 0 });
  });
});
