import { describe, expect, it } from "vitest";
import type { ExplorerMove, ExplorerResponse } from "@/types/chess";
import {
  EXPLORER_DISPLAY_MOVES,
  EXPLORER_MOVES_LIMIT,
  forDisplay,
  gameCount,
  isCacheEntryCurrent,
  normalizeCastling,
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
