import type { ExplorerResponse } from "@/types/chess";

/** Most explorer requests the region map keeps open at once. */
export const EXPLORER_MAX_IN_FLIGHT = 4;

/** How long a position that failed to load waits before it may be requested again. */
export const FAILED_RETRY_MS = 30_000;

/** Pause after a 429 that doesn't say how long to wait. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: ExplorerResponse }
  | { status: "failed" };

/** A position the view wants, with a priority (its on-screen size): biggest loads first. */
export type LoadRequest = { fen: string; priority: number };

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type LoaderOptions = {
  maxInFlight?: number;
  /** Where loaded data is kept. Defaults to one cache for the page session, so a tab switch keeps it. */
  cache?: Map<string, ExplorerResponse>;
  fetchFn?: FetchFn;
  /** Called whenever a load finishes or a pause ends, so the view can redraw and re-request. */
  onChange?: () => void;
};

export type ExplorerLoader = {
  get(fen: string): LoadState | undefined;
  /** Replaces the waiting queue with these positions, then starts loads up to the limit. */
  want(requests: Iterable<LoadRequest>): void;
  stats(): { inFlight: number; queued: number; pausedMs: number };
  /** Aborts every open request and ignores anything still arriving. */
  dispose(): void;
};

const sessionCache = new Map<string, ExplorerResponse>();

function byPriority(a: LoadRequest, b: LoadRequest) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.fen < b.fen ? -1 : a.fen > b.fen ? 1 : 0;
}

/**
 * Loads explorer data for the region map through `/api/openings/explorer`, never Lichess
 * directly. Requests are de-duplicated, capped at `maxInFlight`, served biggest-first, and
 * paused for the server's `Retry-After` when Lichess rate-limits.
 */
export function createExplorerLoader(options: LoaderOptions = {}): ExplorerLoader {
  const maxInFlight = options.maxInFlight ?? EXPLORER_MAX_IN_FLIGHT;
  const cache = options.cache ?? sessionCache;
  const fetchFn: FetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));

  const inFlight = new Map<string, { controller: AbortController; priority: number }>();
  const failedAt = new Map<string, number>();
  let queue: LoadRequest[] = [];
  let pausedUntil = 0;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function isWaiting(fen: string) {
    if (cache.has(fen) || inFlight.has(fen)) return false;
    const failed = failedAt.get(fen);
    return failed === undefined || Date.now() - failed >= FAILED_RETRY_MS;
  }

  function pump() {
    if (disposed) return;

    const wait = pausedUntil - Date.now();
    if (wait > 0) {
      if (resumeTimer === undefined) {
        resumeTimer = setTimeout(() => {
          resumeTimer = undefined;
          pump();
          options.onChange?.();
        }, wait);
      }
      return;
    }

    while (inFlight.size < maxInFlight && queue.length > 0) {
      const next = queue.shift()!;
      if (isWaiting(next.fen)) void load(next);
    }
  }

  async function load({ fen, priority }: LoadRequest) {
    const controller = new AbortController();
    inFlight.set(fen, { controller, priority });

    try {
      const res = await fetchFn("/api/openings/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const seconds = Number(res.headers.get("retry-after")) || DEFAULT_RETRY_AFTER_SECONDS;
        pausedUntil = Math.max(pausedUntil, Date.now() + seconds * 1000);
        // Back in line, so it is first to go when the pause ends.
        queue = [...queue, { fen, priority }].sort(byPriority);
        return;
      }

      if (!res.ok) {
        failedAt.set(fen, Date.now());
        return;
      }

      const body = (await res.json()) as ExplorerResponse;
      if (!Array.isArray(body?.moves)) {
        failedAt.set(fen, Date.now());
        return;
      }

      // Keep only the explorer fields; the route also sends `fen` and `cached`.
      cache.set(fen, {
        moves: body.moves,
        opening: body.opening,
        totals: body.totals,
        movesLimit: body.movesLimit,
      });
      failedAt.delete(fen);
    } catch {
      if (!disposed) failedAt.set(fen, Date.now());
    } finally {
      inFlight.delete(fen);
      if (!disposed) {
        pump();
        options.onChange?.();
      }
    }
  }

  return {
    get(fen) {
      const data = cache.get(fen);
      if (data) return { status: "loaded", data };
      if (inFlight.has(fen) || queue.some((r) => r.fen === fen)) return { status: "loading" };
      if (failedAt.has(fen)) return { status: "failed" };
      return undefined;
    },

    want(requests) {
      if (disposed) return;
      const best = new Map<string, number>();
      for (const { fen, priority } of requests) {
        if (!isWaiting(fen)) continue;
        best.set(fen, Math.max(best.get(fen) ?? -Infinity, priority));
      }
      queue = [...best].map(([fen, priority]) => ({ fen, priority })).sort(byPriority);
      pump();
    },

    stats() {
      return {
        inFlight: inFlight.size,
        queued: queue.length,
        pausedMs: Math.max(0, pausedUntil - Date.now()),
      };
    },

    dispose() {
      disposed = true;
      queue = [];
      if (resumeTimer !== undefined) clearTimeout(resumeTimer);
      for (const { controller } of inFlight.values()) controller.abort();
      inFlight.clear();
    },
  };
}
