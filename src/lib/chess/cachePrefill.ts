// The loop behind `npm run cache:prefill`. It does no I/O of its own: loading, waiting and
// reporting are passed in, so it runs the same in the script and in tests.
import { gameCount } from "@/lib/chess/explorerData";
import type { ExplorerResult } from "@/lib/chess/explorerService";
import { fenAfterUci, toPositionKey } from "@/lib/chess/fen";

/** Pause after a rate limit, whatever shorter wait Lichess asks for. */
export const RATE_LIMIT_MIN_WAIT_SECONDS = 60;

/** Failures or rate limits in a row before the run gives up (a missing token fails every call). */
export const MAX_CONSECUTIVE_FAILURES = 5;

export type PrefillCounts = {
  /** Positions already in the cache. */
  cached: number;
  /** Positions fetched from Lichess and stored by this run. */
  fetched: number;
  /** Positions not in the cache that `load` chose not to fetch (a dry run). */
  missing: number;
  failed: number;
  /** Positions found but not yet visited. */
  queued: number;
};

export type PrefillResult = PrefillCounts & { stopped: "done" | "limit" | "failures" };

export type PrefillOptions = {
  /** Positions to start from, as full FENs. */
  fens: string[];
  /** Loads one position. `cached: false` means it came from Lichess; null means it is missing. */
  load: (fen: string) => Promise<ExplorerResult | null>;
  /** Seconds to wait if this error is a rate limit, or null if it is some other failure. */
  retryAfterSeconds: (error: unknown) => number | null;
  sleep: (ms: number) => Promise<void>;
  /** Pause after each Lichess call. */
  delayMs: number;
  /** Also visit every move played in at least this many games, to any depth. */
  minGames?: number;
  /** Stop once this many positions have been fetched, or found missing. */
  limit?: number;
  onProgress?: (counts: PrefillCounts) => void;
};

/**
 * Visits every starting position, one at a time, in order. With `minGames`, moves played
 * often enough are added to the end of the line, so the walk is breadth-first. Positions
 * are told apart by `toPositionKey`, so each is visited once however it is reached.
 */
export async function prefillPositions(options: PrefillOptions): Promise<PrefillResult> {
  const seen = new Set<string>();
  const queue: string[] = [];
  const counts: PrefillCounts = { cached: 0, fetched: 0, missing: 0, failed: 0, queued: 0 };
  let consecutiveFailures = 0;

  function enqueue(fen: string) {
    const key = toPositionKey(fen);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(fen);
  }

  options.fens.forEach(enqueue);

  for (let next = 0; next < queue.length; next++) {
    const fen = queue[next];
    let result: ExplorerResult | null;

    try {
      result = await options.load(fen);
      consecutiveFailures = 0;
    } catch (error) {
      const retryAfter = options.retryAfterSeconds(error);
      const rateLimited = retryAfter !== null;
      if (!rateLimited) counts.failed++;
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        // A rate-limited position was never finished, so it still counts as waiting.
        const queued = queue.length - next - (rateLimited ? 0 : 1);
        return { ...counts, queued, stopped: "failures" };
      }

      if (rateLimited) {
        await options.sleep(Math.max(retryAfter, RATE_LIMIT_MIN_WAIT_SECONDS) * 1000);
        next--; // Same position again.
      }
      continue;
    }

    if (result === null) counts.missing++;
    else if (result.cached) counts.cached++;
    else counts.fetched++;

    if (result && options.minGames !== undefined) {
      for (const move of result.data.moves) {
        if (gameCount(move) < options.minGames) continue;
        const child = fenAfterUci(fen, move.uci);
        if (child) enqueue(child);
      }
    }

    counts.queued = queue.length - next - 1;
    options.onProgress?.({ ...counts });

    if (options.limit !== undefined && counts.fetched + counts.missing >= options.limit) {
      return { ...counts, stopped: "limit" };
    }

    if (result && !result.cached) await options.sleep(options.delayMs);
  }

  return { ...counts, queued: 0, stopped: "done" };
}
