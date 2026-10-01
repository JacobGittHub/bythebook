import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerResponse } from "@/types/chess";
import { EXPLORER_MOVES_LIMIT } from "./explorerData";
import { getExplorerData } from "./explorerService";

const cache = vi.hoisted(() => ({
  getCachedPosition: vi.fn(),
  setCachedPosition: vi.fn(),
}));
const lichess = vi.hoisted(() => ({ fetchExplorerMoves: vi.fn() }));

vi.mock("@/lib/db/positionCache", () => cache);
vi.mock("@/lib/chess/lichessExplorer", () => lichess);

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const castle = { san: "O-O", uci: "e1h1", white: 1, draws: 0, black: 0 };
const totals = { white: 1, draws: 0, black: 0 };
const current: ExplorerResponse = { moves: [castle], totals, movesLimit: EXPLORER_MOVES_LIMIT };
const old: ExplorerResponse = { moves: [castle] };

beforeEach(() => {
  vi.resetAllMocks();
  cache.setCachedPosition.mockResolvedValue(undefined);
});

describe("getExplorerData", () => {
  it("serves a current cache row without calling Lichess", async () => {
    cache.getCachedPosition.mockResolvedValue(current);
    const result = await getExplorerData(FEN);
    expect(result.cached).toBe(true);
    expect(result.data.moves[0].uci).toBe("e1g1");
    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
  });

  it("refetches and replaces a row cached by older code", async () => {
    cache.getCachedPosition.mockResolvedValue(old);
    lichess.fetchExplorerMoves.mockResolvedValue(current);
    const result = await getExplorerData(FEN);
    expect(result.cached).toBe(false);
    expect(result.data.totals).toEqual(totals);
    expect(cache.setCachedPosition).toHaveBeenCalledWith(FEN, expect.objectContaining({ totals }));
    expect(cache.setCachedPosition.mock.calls[0][1].moves[0].uci).toBe("e1g1");
  });

  it("serves the old row when the refetch fails", async () => {
    cache.getCachedPosition.mockResolvedValue(old);
    lichess.fetchExplorerMoves.mockRejectedValue(new Error("rate limited"));
    const result = await getExplorerData(FEN);
    expect(result).toEqual({ data: { moves: [{ ...castle, uci: "e1g1" }] }, cached: true });
    expect(cache.setCachedPosition).not.toHaveBeenCalled();
  });

  it("fetches and stores on a miss, and throws if that fails", async () => {
    cache.getCachedPosition.mockResolvedValue(null);
    lichess.fetchExplorerMoves.mockResolvedValue(current);
    expect((await getExplorerData(FEN)).cached).toBe(false);
    expect(cache.setCachedPosition).toHaveBeenCalledTimes(1);

    lichess.fetchExplorerMoves.mockRejectedValue(new Error("down"));
    await expect(getExplorerData(FEN)).rejects.toThrow("down");
  });
});
