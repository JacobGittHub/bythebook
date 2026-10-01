import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerResponse } from "@/types/chess";
import { EXPLORER_MOVES_LIMIT } from "./explorerData";
import { getExplorerData, getExplorerDataForUser } from "./explorerService";

const cache = vi.hoisted(() => ({
  getCachedPosition: vi.fn(),
  setCachedPosition: vi.fn(),
}));
const lichess = vi.hoisted(() => ({ fetchExplorerMoves: vi.fn() }));
const usage = vi.hoisted(() => ({ recordUsage: vi.fn() }));

vi.mock("@/lib/db/positionCache", () => cache);
vi.mock("@/lib/chess/lichessExplorer", () => lichess);
vi.mock("@/lib/db/usage", () => usage);

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const USER = "user-1";
const castle = { san: "O-O", uci: "e1h1", white: 1, draws: 0, black: 0 };
const totals = { white: 1, draws: 0, black: 0 };
const current: ExplorerResponse = { moves: [castle], totals, movesLimit: EXPLORER_MOVES_LIMIT };
const old: ExplorerResponse = { moves: [castle] };
const oldServed = { data: { moves: [{ ...castle, uci: "e1g1" }] }, cached: true };

const allow = async () => true;
const refuse = async () => false;

beforeEach(() => {
  vi.resetAllMocks();
  cache.setCachedPosition.mockResolvedValue(undefined);
  usage.recordUsage.mockResolvedValue(1);
});

describe("getExplorerData", () => {
  it("serves a current cache row without asking the gate or calling Lichess", async () => {
    cache.getCachedPosition.mockResolvedValue(current);
    const gate = vi.fn(allow);
    const result = await getExplorerData(FEN, gate);
    expect(result?.cached).toBe(true);
    expect(result?.data.moves[0].uci).toBe("e1g1");
    expect(gate).not.toHaveBeenCalled();
    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
  });

  it("refetches and replaces a row cached by older code", async () => {
    cache.getCachedPosition.mockResolvedValue(old);
    lichess.fetchExplorerMoves.mockResolvedValue(current);
    const result = await getExplorerData(FEN, allow);
    expect(result?.cached).toBe(false);
    expect(result?.data.totals).toEqual(totals);
    expect(cache.setCachedPosition).toHaveBeenCalledWith(FEN, expect.objectContaining({ totals }));
    expect(cache.setCachedPosition.mock.calls[0][1].moves[0].uci).toBe("e1g1");
  });

  it("serves the old row when the refetch fails", async () => {
    cache.getCachedPosition.mockResolvedValue(old);
    lichess.fetchExplorerMoves.mockRejectedValue(new Error("rate limited"));
    expect(await getExplorerData(FEN, allow)).toEqual(oldServed);
    expect(cache.setCachedPosition).not.toHaveBeenCalled();
  });

  it("fetches and stores on a miss, and throws if that fails", async () => {
    cache.getCachedPosition.mockResolvedValue(null);
    lichess.fetchExplorerMoves.mockResolvedValue(current);
    expect((await getExplorerData(FEN, allow))?.cached).toBe(false);
    expect(cache.setCachedPosition).toHaveBeenCalledTimes(1);

    lichess.fetchExplorerMoves.mockRejectedValue(new Error("down"));
    await expect(getExplorerData(FEN, allow)).rejects.toThrow("down");
  });

  it("never calls Lichess when the gate refuses", async () => {
    cache.getCachedPosition.mockResolvedValue(null);
    expect(await getExplorerData(FEN, refuse)).toBeNull();

    cache.getCachedPosition.mockResolvedValue(old);
    expect(await getExplorerData(FEN, refuse)).toEqual(oldServed);

    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
    expect(cache.setCachedPosition).not.toHaveBeenCalled();
  });
});

describe("getExplorerDataForUser", () => {
  it("gives a guest cached positions only", async () => {
    cache.getCachedPosition.mockResolvedValue(current);
    expect((await getExplorerDataForUser(FEN, null))?.cached).toBe(true);

    cache.getCachedPosition.mockResolvedValue(null);
    expect(await getExplorerDataForUser(FEN, null)).toBeNull();

    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
    expect(usage.recordUsage.mock.calls).toEqual([
      [null, "explorer"],
      [null, "explorer"],
    ]);
  });

  it("fetches live for a signed-in user and counts the Lichess call", async () => {
    cache.getCachedPosition.mockResolvedValue(null);
    lichess.fetchExplorerMoves.mockResolvedValue(current);
    expect((await getExplorerDataForUser(FEN, USER))?.cached).toBe(false);
    expect(usage.recordUsage.mock.calls).toEqual([
      [USER, "explorer"],
      [USER, "lichess"],
    ]);
  });

  it("counts no Lichess call when the cache answers", async () => {
    cache.getCachedPosition.mockResolvedValue(current);
    await getExplorerDataForUser(FEN, USER);
    expect(usage.recordUsage.mock.calls).toEqual([[USER, "explorer"]]);
  });
});
