import { isCacheEntryCurrent, normalizeCastling } from "@/lib/chess/explorerData";
import { fetchExplorerMoves } from "@/lib/chess/lichessExplorer";
import { getCachedPosition, setCachedPosition } from "@/lib/db/positionCache";
import type { ExplorerResponse } from "@/types/chess";

/**
 * Explorer data for a position. A current cache row is served as-is. A missing row, or one
 * cached by older code (no totals, or fewer moves), is fetched from Lichess and upserted.
 * If that refetch fails, an old row is served rather than an error.
 */
export async function getExplorerData(
  fen: string,
): Promise<{ data: ExplorerResponse; cached: boolean }> {
  const cached = await getCachedPosition(fen);

  if (cached && isCacheEntryCurrent(cached)) {
    return { data: normalizeCastling(cached), cached: true };
  }

  let fresh: ExplorerResponse;
  try {
    fresh = normalizeCastling(await fetchExplorerMoves(fen));
  } catch (error) {
    if (cached) return { data: normalizeCastling(cached), cached: true };
    throw error;
  }

  await setCachedPosition(fen, fresh);
  return { data: fresh, cached: false };
}
