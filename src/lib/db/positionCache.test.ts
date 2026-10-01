import { describe, expect, it, vi } from "vitest";
import { isCacheEntryCurrent, EXPLORER_MOVES_LIMIT } from "@/lib/chess/explorerData";
import { parseCachedExplorerData } from "./positionCache";

vi.mock("@/lib/supabase", () => ({ createAdminSupabaseClient: vi.fn() }));

const moves = [{ san: "e4", uci: "e2e4", white: 3, draws: 2, black: 1 }];
const totals = { white: 3, draws: 2, black: 1 };

describe("parseCachedExplorerData", () => {
  it("reads a row whose opening is null, as Lichess sends for an unnamed position", () => {
    const row = { moves, totals, opening: null, movesLimit: EXPLORER_MOVES_LIMIT };
    const data = parseCachedExplorerData(row);
    expect(data).toEqual({ moves, totals, opening: undefined, movesLimit: EXPLORER_MOVES_LIMIT });
    expect(data && isCacheEntryCurrent(data)).toBe(true);
  });

  it("reads a row with an opening, and an old row with only moves", () => {
    const opening = { eco: "B00", name: "King's Pawn" };
    expect(parseCachedExplorerData({ moves, totals, opening })?.opening).toEqual(opening);
    expect(parseCachedExplorerData({ moves })?.moves).toEqual(moves);
  });

  it("returns null for anything that isn't explorer data", () => {
    expect(parseCachedExplorerData(null)).toBeNull();
    expect(parseCachedExplorerData({ totals })).toBeNull();
    expect(parseCachedExplorerData({ moves: [{ san: "e4" }] })).toBeNull();
  });
});
