import { describe, expect, it, vi } from "vitest";
import type { ExplorerResponse } from "@/types/chess";
import {
  MAX_CONSECUTIVE_FAILURES,
  RATE_LIMIT_MIN_WAIT_SECONDS,
  prefillPositions,
  type PrefillOptions,
} from "./cachePrefill";
import type { ExplorerResult } from "./explorerService";
import { START_FEN, fenAfterUci, toPositionKey } from "./fen";

const E4 = fenAfterUci(START_FEN, "e2e4")!;
const D4 = fenAfterUci(START_FEN, "d2d4")!;
const NF3 = fenAfterUci(START_FEN, "g1f3")!;
const NF3_NF6 = fenAfterUci(NF3, "g8f6")!;

class RateLimit extends Error {}

function move(uci: string, games: number) {
  return { san: uci, uci, white: games, draws: 0, black: 0 };
}

function fetched(moves: ExplorerResponse["moves"] = []): ExplorerResult {
  return { data: { moves }, cached: false };
}

function run(overrides: Partial<PrefillOptions> & Pick<PrefillOptions, "load">) {
  const sleep = vi.fn(async () => {});
  const result = prefillPositions({
    fens: [START_FEN],
    retryAfterSeconds: (error) => (error instanceof RateLimit ? 5 : null),
    sleep,
    delayMs: 1000,
    ...overrides,
  });
  return { result, sleep };
}

describe("prefillPositions", () => {
  it("visits each position once, in order, however its FEN is written", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => fetched());
    // The same position as E4 with different move counters.
    const e4Later = E4.replace(/ 0 1$/, " 7 12");
    const { result } = run({ load, fens: [START_FEN, E4, e4Later, D4] });

    expect(await result).toEqual({
      cached: 0, fetched: 3, missing: 0, failed: 0, queued: 0, stopped: "done",
    });
    expect(load.mock.calls.map(([fen]) => fen)).toEqual([START_FEN, E4, D4]);
  });

  it("pauses only after a Lichess call", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async (fen: string) =>
      fen === E4 ? { data: { moves: [] }, cached: true } : fetched(),
    );
    const { result, sleep } = run({ load, fens: [START_FEN, E4, D4] });

    expect(await result).toMatchObject({ cached: 1, fetched: 2, stopped: "done" });
    expect(sleep.mock.calls).toEqual([[1000], [1000]]);
  });

  it("without minGames, follows no moves", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => fetched([move("e2e4", 1_000_000)]));
    const { result } = run({ load });

    expect(await result).toMatchObject({ fetched: 1, stopped: "done" });
  });

  it("with minGames, follows moves played often enough, breadth-first", async () => {
    const tree: Record<string, ExplorerResponse["moves"]> = {
      [toPositionKey(START_FEN)]: [move("e2e4", 500), move("g1f3", 100), move("a2a3", 99)],
      [toPositionKey(NF3)]: [move("g8f6", 100)],
      // 1. e4 can't be followed by a white move: an illegal move is skipped, not thrown.
      [toPositionKey(E4)]: [move("e2e4", 400)],
    };
    const load = vi.fn<PrefillOptions["load"]>(async (fen: string) => fetched(tree[toPositionKey(fen)] ?? []));
    const { result } = run({ load, minGames: 100 });

    expect(await result).toMatchObject({ fetched: 4, queued: 0, stopped: "done" });
    expect(load.mock.calls.map(([fen]) => fen)).toEqual([START_FEN, E4, NF3, NF3_NF6]);
  });

  it("stops at the limit and reports what is left", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => fetched());
    const { result } = run({ load, fens: [START_FEN, E4, D4, NF3], limit: 2 });

    expect(await result).toMatchObject({ fetched: 2, queued: 2, stopped: "limit" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("counts a position that load leaves alone as missing, toward the limit", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => null);
    const { result, sleep } = run({ load, fens: [START_FEN, E4, D4], limit: 2 });

    expect(await result).toMatchObject({ missing: 2, fetched: 0, queued: 1, stopped: "limit" });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits out a rate limit and retries the same position", async () => {
    const load = vi
      .fn<PrefillOptions["load"]>()
      .mockRejectedValueOnce(new RateLimit())
      .mockResolvedValue(fetched());
    const { result, sleep } = run({ load, fens: [START_FEN, E4] });

    expect(await result).toMatchObject({ fetched: 2, failed: 0, stopped: "done" });
    expect(load.mock.calls.map(([fen]) => fen)).toEqual([START_FEN, START_FEN, E4]);
    // Lichess asked for 5 seconds; the minimum wait wins.
    expect(sleep.mock.calls[0]).toEqual([RATE_LIMIT_MIN_WAIT_SECONDS * 1000]);
  });

  it("skips a failed position and carries on", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async (fen: string) => {
      if (fen === E4) throw new Error("boom");
      return fetched();
    });
    const { result } = run({ load, fens: [START_FEN, E4, D4] });

    expect(await result).toMatchObject({ fetched: 2, failed: 1, stopped: "done" });
  });

  it("gives up after too many failures in a row", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => {
      throw new Error("no token");
    });
    const fens = [START_FEN, E4, D4, NF3, NF3_NF6, fenAfterUci(E4, "e7e5")!, fenAfterUci(D4, "d7d5")!];
    const { result } = run({ load, fens });

    expect(await result).toEqual({
      cached: 0,
      fetched: 0,
      missing: 0,
      failed: MAX_CONSECUTIVE_FAILURES,
      queued: fens.length - MAX_CONSECUTIVE_FAILURES,
      stopped: "failures",
    });
  });

  it("gives up when the rate limit never lifts", async () => {
    const load = vi.fn<PrefillOptions["load"]>(async () => {
      throw new RateLimit();
    });
    const { result } = run({ load, fens: [START_FEN, E4] });

    expect(await result).toMatchObject({ failed: 0, queued: 2, stopped: "failures" });
    expect(load).toHaveBeenCalledTimes(MAX_CONSECUTIVE_FAILURES);
  });
});
