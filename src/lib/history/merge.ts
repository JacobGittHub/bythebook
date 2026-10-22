// Merging an import's games into a stored history (D23, D28). A history is kept in the order its
// games were imported, each import's oldest played first, in chunks numbered upward (D15). New
// games fill the last chunk and then new ones; when there isn't room, the user chooses to stop
// (only the newest of the new games that fit are kept) or to replace (the games imported
// earliest are dropped from the front). Either way only the chunks at the two ends change, so
// only those are written again.

import { GAMES_PER_CHUNK, type LimitChoice, type StoredChunk, type StoredGame } from "./types";

export type MergeReport = {
  /** New games kept. */
  added: number;
  /** Games already stored, or read twice in this import. */
  duplicates: number;
  /** New games not kept, for want of room. */
  leftOut: number;
  /** Stored games dropped, earliest imported first, to make room or to meet a lowered limit. */
  removed: number;
  /** Games in the history after the merge. */
  total: number;
  /** The chunks to write whole, in order. */
  written: number[];
  /** The chunks to delete. */
  deleted: number[];
};

type Dated = { playedAt: string | null; key: string };

/** Oldest first, by when each game was played (unknown first), then by key, so ties are stable. */
export function comparePlayed(a: Dated, b: Dated): number {
  const [x, y] = [a.playedAt ?? "", b.playedAt ?? ""];
  if (x !== y) return x < y ? -1 : 1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** `comparePlayed` for stored games. */
export const compareGames = (a: StoredGame, b: StoredGame): number => comparePlayed(a.record, b.record);

/** Games split into chunks of `size`, in order. */
export function toChunks<T>(games: readonly T[], size = GAMES_PER_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < games.length; i += size) chunks.push(games.slice(i, i + size));
  return chunks;
}

/**
 * How many of `fresh` new games a history of `stored` games keeps, and how many stored games it
 * drops, under `limit`. Stopping keeps only what fits; replacing keeps up to the whole limit of
 * new games and drops the earliest imported to make room. A history over a lowered limit drops
 * its earliest either way.
 */
export function makeRoom(stored: number, fresh: number, limit: number, choice: LimitChoice): { keep: number; drop: number } {
  const cap = Math.max(0, limit);
  const over = Math.max(0, stored - cap);
  const left = stored - over;
  if (choice === "stop") return { keep: Math.min(fresh, cap - left), drop: over };
  const keep = Math.min(fresh, cap);
  return { keep, drop: over + Math.max(0, left + keep - cap) };
}

export type MergeOptions = { limit: number; choice: LimitChoice; size?: number };

/** `chunks` with the new games among `incoming` added, under the limit and the user's choice. */
export function mergeGames(
  chunks: readonly StoredChunk[],
  incoming: readonly StoredGame[],
  { limit, choice, size = GAMES_PER_CHUNK }: MergeOptions,
): { chunks: StoredChunk[]; report: MergeReport } {
  const seen = new Set(chunks.flatMap((chunk) => chunk.games.map((game) => game.record.key)));
  const fresh: StoredGame[] = [];
  for (const game of incoming) {
    if (seen.has(game.record.key)) continue;
    seen.add(game.record.key);
    fresh.push(game);
  }
  fresh.sort(compareGames);

  const stored = chunks.reduce((sum, chunk) => sum + chunk.games.length, 0);
  const { keep, drop } = makeRoom(stored, fresh.length, limit, choice);
  const added = fresh.slice(fresh.length - keep);

  const written = new Set<number>();
  const deleted: number[] = [];
  const result: StoredChunk[] = [];
  let toDrop = drop;
  for (const chunk of chunks) {
    if (toDrop > 0 && toDrop >= chunk.games.length) {
      deleted.push(chunk.n);
      toDrop -= chunk.games.length;
    } else if (toDrop > 0) {
      result.push({ n: chunk.n, games: chunk.games.slice(toDrop) });
      written.add(chunk.n);
      toDrop = 0;
    } else {
      result.push(chunk);
    }
  }

  let rest = added;
  const last = result.at(-1);
  if (last && last.games.length < size && rest.length) {
    const room = size - last.games.length;
    result[result.length - 1] = { n: last.n, games: [...last.games, ...rest.slice(0, room)] };
    written.add(last.n);
    rest = rest.slice(room);
  }
  let next = chunks.reduce((max, chunk) => Math.max(max, chunk.n + 1), 0);
  for (const games of toChunks(rest, size)) {
    result.push({ n: next, games });
    written.add(next++);
  }

  return {
    chunks: result,
    report: {
      added: added.length,
      duplicates: incoming.length - fresh.length,
      leftOut: fresh.length - added.length,
      removed: drop,
      total: stored - drop + added.length,
      written: [...written].sort((a, b) => a - b),
      deleted,
    },
  };
}
