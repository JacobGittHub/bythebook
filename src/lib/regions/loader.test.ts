import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerResponse } from "@/types/chess";
import { FAILED_RETRY_MS, createExplorerLoader, type FetchFn } from "./loader";

type Call = { url: string; init: RequestInit; fen: string; resolve: (res: Response) => void };

/** A fetch whose responses the test hands out one by one. */
function controlledFetch() {
  const calls: Call[] = [];
  const fetchFn: FetchFn = (url, init) =>
    new Promise((resolve, reject) => {
      const fen = (JSON.parse(String(init.body)) as { fen: string }).fen;
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      calls.push({ url, init, fen, resolve });
    });
  return { calls, fetchFn };
}

const ok = (fen: string) =>
  new Response(
    JSON.stringify({ fen, cached: true, moves: [], totals: { white: 1, draws: 0, black: 0 }, movesLimit: 20 }),
    { status: 200 },
  );

/** Lets pending promise chains (including response bodies) finish. */
async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createExplorerLoader", () => {
  it("posts each position to the explorer route", () => {
    const { calls, fetchFn } = controlledFetch();
    createExplorerLoader({ fetchFn, cache: new Map() }).want([{ fen: "a", priority: 1 }]);
    expect(calls[0].url).toBe("/api/openings/explorer");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ fen: "a" });
  });

  it("keeps at most four requests open and serves the biggest first", async () => {
    const { calls, fetchFn } = controlledFetch();
    const onChange = vi.fn();
    const loader = createExplorerLoader({ fetchFn, cache: new Map(), onChange });

    loader.want([1, 2, 3, 4, 5, 6].map((n) => ({ fen: `p${n}`, priority: n })));
    expect(calls.map((c) => c.fen)).toEqual(["p6", "p5", "p4", "p3"]);
    expect(loader.get("p1")).toEqual({ status: "loading" });

    calls[0].resolve(ok("p6"));
    await flush();
    expect(loader.get("p6")?.status).toBe("loaded");
    expect(calls.map((c) => c.fen)).toEqual(["p6", "p5", "p4", "p3", "p2"]);
    expect(onChange).toHaveBeenCalled();
  });

  it("requests each position once", async () => {
    const { calls, fetchFn } = controlledFetch();
    const loader = createExplorerLoader({ fetchFn, cache: new Map() });

    loader.want([{ fen: "a", priority: 1 }, { fen: "a", priority: 5 }]);
    loader.want([{ fen: "a", priority: 1 }]);
    expect(calls).toHaveLength(1);

    calls[0].resolve(ok("a"));
    await flush();
    loader.want([{ fen: "a", priority: 1 }]);
    expect(calls).toHaveLength(1);
  });

  it("stores only the explorer fields", async () => {
    const { calls, fetchFn } = controlledFetch();
    const cache = new Map<string, ExplorerResponse>();
    createExplorerLoader({ fetchFn, cache }).want([{ fen: "a", priority: 1 }]);
    calls[0].resolve(ok("a"));
    await flush();
    expect(Object.keys(cache.get("a")!).sort()).toEqual(["movesLimit", "moves", "opening", "totals"].sort());
  });

  it("drops waiting positions the view no longer wants", async () => {
    const { calls, fetchFn } = controlledFetch();
    const loader = createExplorerLoader({ fetchFn, cache: new Map(), maxInFlight: 1 });

    loader.want([{ fen: "a", priority: 3 }, { fen: "b", priority: 2 }, { fen: "c", priority: 1 }]);
    loader.want([{ fen: "c", priority: 1 }]);
    calls[0].resolve(ok("a"));
    await flush();
    expect(calls.map((c) => c.fen)).toEqual(["a", "c"]);
  });

  it("pauses for Retry-After on a 429, then retries that position first", async () => {
    const { calls, fetchFn } = controlledFetch();
    const onChange = vi.fn();
    const loader = createExplorerLoader({ fetchFn, cache: new Map(), maxInFlight: 1, onChange });

    loader.want([{ fen: "a", priority: 2 }, { fen: "b", priority: 1 }]);
    calls[0].resolve(new Response("{}", { status: 429, headers: { "Retry-After": "2" } }));
    await flush();
    expect(calls).toHaveLength(1);
    expect(loader.stats().pausedMs).toBe(2000);
    expect(loader.get("a")).toEqual({ status: "loading" });

    vi.advanceTimersByTime(1999);
    expect(calls).toHaveLength(1);
    onChange.mockClear();
    vi.advanceTimersByTime(1);
    expect(calls.map((c) => c.fen)).toEqual(["a", "a"]);
    expect(onChange).toHaveBeenCalled();
  });

  it("marks failures, and asks again only after the retry delay", async () => {
    const { calls, fetchFn } = controlledFetch();
    const loader = createExplorerLoader({ fetchFn, cache: new Map() });

    loader.want([{ fen: "a", priority: 1 }]);
    calls[0].resolve(new Response("{}", { status: 500 }));
    await flush();
    expect(loader.get("a")).toEqual({ status: "failed" });

    loader.want([{ fen: "a", priority: 1 }]);
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(FAILED_RETRY_MS);
    loader.want([{ fen: "a", priority: 1 }]);
    expect(calls).toHaveLength(2);
  });

  it("aborts open requests on dispose and ignores what arrives after", async () => {
    const { calls, fetchFn } = controlledFetch();
    const onChange = vi.fn();
    const loader = createExplorerLoader({ fetchFn, cache: new Map(), onChange });

    loader.want([{ fen: "a", priority: 1 }]);
    loader.dispose();
    await flush();
    expect(calls[0].init.signal?.aborted).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(loader.get("a")).toBeUndefined();

    loader.want([{ fen: "b", priority: 1 }]);
    expect(calls).toHaveLength(1);
  });

  it("shares loaded data between loaders using the same cache", async () => {
    const { calls, fetchFn } = controlledFetch();
    const cache = new Map<string, ExplorerResponse>();
    createExplorerLoader({ fetchFn, cache }).want([{ fen: "a", priority: 1 }]);
    calls[0].resolve(ok("a"));
    await flush();

    const second = createExplorerLoader({ fetchFn, cache });
    expect(second.get("a")?.status).toBe("loaded");
    second.want([{ fen: "a", priority: 1 }]);
    expect(calls).toHaveLength(1);
  });
});
