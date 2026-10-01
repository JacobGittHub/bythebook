import { isCacheEntryCurrent, normalizeCastling } from "@/lib/chess/explorerData";
import { fetchExplorerMoves } from "@/lib/chess/lichessExplorer";
import { getCachedPosition, setCachedPosition } from "@/lib/db/positionCache";
import { recordUsage } from "@/lib/db/usage";
import type { ExplorerResponse } from "@/types/chess";

export type ExplorerResult = { data: ExplorerResponse; cached: boolean };

/** Asked just before a Lichess request. Resolving false refuses the request. */
export type LiveFetchGate = () => Promise<boolean>;

/**
 * Explorer data for a position. A current cache row is served as-is. A missing row, or one
 * cached by older code (no totals, or fewer moves), is fetched from Lichess and upserted,
 * if `mayFetchLive` allows it. If the fetch is refused or fails, an old row is served
 * rather than nothing. Returns null when there is no row and the fetch was refused.
 */
export async function getExplorerData(
  fen: string,
  mayFetchLive: LiveFetchGate,
): Promise<ExplorerResult | null> {
  const cached = await getCachedPosition(fen);

  if (cached && isCacheEntryCurrent(cached)) {
    return { data: normalizeCastling(cached), cached: true };
  }

  const stale = cached ? { data: normalizeCastling(cached), cached: true } : null;
  if (!(await mayFetchLive())) return stale;

  let fresh: ExplorerResponse;
  try {
    fresh = normalizeCastling(await fetchExplorerMoves(fen));
  } catch (error) {
    if (stale) return stale;
    throw error;
  }

  await setCachedPosition(fen, fresh);
  return { data: fresh, cached: false };
}

/**
 * Explorer data for one request. Guests (a null user) read the cache only and never reach
 * Lichess. A signed-in user's request may, and each such call is counted.
 */
export async function getExplorerDataForUser(
  fen: string,
  userId: string | null,
): Promise<ExplorerResult | null> {
  await recordUsage(userId, "explorer");

  return getExplorerData(fen, async () => {
    if (!userId) return false;
    await recordUsage(userId, "lichess");
    return true;
  });
}
