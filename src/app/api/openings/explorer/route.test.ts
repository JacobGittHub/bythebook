import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_MOVES_LIMIT } from "@/lib/chess/explorerData";
import type { ExplorerResponse } from "@/types/chess";

// The route with Supabase, the cache and Lichess mocked: what a guest and a signed-in user
// each get back, and that a guest's request never reaches Lichess.
const auth = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn() }));
const cache = vi.hoisted(() => ({
  getCachedPosition: vi.fn(),
  setCachedPosition: vi.fn(),
}));
const usage = vi.hoisted(() => ({ recordUsage: vi.fn() }));
const lichess = vi.hoisted(() => {
  class LichessRateLimitError extends Error {
    retryAfterSeconds: number;
    constructor(retryAfterSeconds = 60) {
      super("Lichess Opening Explorer rate limit exceeded.");
      this.name = "LichessRateLimitError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { fetchExplorerMoves: vi.fn(), LichessRateLimitError };
});

vi.mock("@/lib/supabase", () => auth);
vi.mock("@/lib/db/positionCache", () => cache);
vi.mock("@/lib/db/usage", () => usage);
vi.mock("@/lib/chess/lichessExplorer", () => lichess);

const { POST } = await import("./route");

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const e4 = { san: "e4", uci: "e2e4", white: 2, draws: 1, black: 1 };
const data: ExplorerResponse = {
  moves: [e4],
  totals: { white: 2, draws: 1, black: 1 },
  movesLimit: EXPLORER_MOVES_LIMIT,
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/openings/explorer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  cache.setCachedPosition.mockResolvedValue(undefined);
  usage.recordUsage.mockResolvedValue(1);
});

describe("POST /api/openings/explorer", () => {
  it("answers a guest from the cache", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);
    cache.getCachedPosition.mockResolvedValue(data);

    const res = await post({ fen: FEN });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ fen: FEN, cached: true, moves: [e4] });
    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
  });

  it("gives a guest a 404 for a position that isn't cached, without asking Lichess", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);
    cache.getCachedPosition.mockResolvedValue(null);

    const res = await post({ fen: FEN });
    expect(res.status).toBe(404);
    expect(lichess.fetchExplorerMoves).not.toHaveBeenCalled();
    expect(cache.setCachedPosition).not.toHaveBeenCalled();
  });

  it("looks a missing position up live for a signed-in user", async () => {
    auth.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    cache.getCachedPosition.mockResolvedValue(null);
    lichess.fetchExplorerMoves.mockResolvedValue(data);

    const res = await post({ fen: FEN });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ cached: false, moves: [e4] });
    expect(lichess.fetchExplorerMoves).toHaveBeenCalledTimes(1);
  });

  it("passes a Lichess rate limit on as a 429 with Retry-After", async () => {
    auth.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    cache.getCachedPosition.mockResolvedValue(null);
    lichess.fetchExplorerMoves.mockRejectedValue(new lichess.LichessRateLimitError(30));

    const res = await post({ fen: FEN });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("rejects a FEN that isn't one", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const res = await post({ fen: "not a position" });
    expect(res.status).toBe(400);
    expect(cache.getCachedPosition).not.toHaveBeenCalled();
  });
});
