// The rules every write to a game history follows, so the browser's store (`browserHistory.ts`)
// accepts only what the account's routes will (D13, D28): records that pass their schema, chunks
// of at most `GAMES_PER_CHUNK`, no more games than the limit, no more chunks than the limit
// needs, plus one for a chunk left partly full at each end, and a list of imports that accounts
// for every game (D30).

import { mergeGames, type MergeReport } from "./merge";
import {
  GAMES_PER_CHUNK,
  HistoryError,
  MAX_IMPORT_NAME_CHARS,
  historyWriteSchema,
  type GameHistoryStore,
  type HistoryImport,
  type HistorySummary,
  type HistoryWrite,
  type LimitChoice,
  type ReadGame,
} from "./types";

/** A history with no games. */
export function emptySummary(limit: number): HistorySummary {
  return { games: 0, limit, chunks: [], username: null, lastImportAt: null, imports: [], version: 0 };
}

/** The most chunks a history under `limit` needs: full ones, and a partial one at each end. */
export function chunkCap(limit: number): number {
  return Math.ceil(limit / GAMES_PER_CHUNK) + 1;
}

/** `change` checked against the rules, and the summary after it, made at `at`. */
export function checkedWrite(current: HistorySummary, change: unknown, at: Date): { change: HistoryWrite; summary: HistorySummary } {
  const parsed = historyWriteSchema.safeParse(change);
  if (!parsed.success) throw new HistoryError("invalid", "Some of the games aren't valid, so nothing was saved.");
  const write = parsed.data;

  const written = write.chunks.map((chunk) => chunk.n);
  if (new Set(written).size !== written.length || written.some((n) => write.deleted.includes(n))) {
    throw new HistoryError("invalid", "A chunk is written twice, or written and deleted.");
  }
  const sizes = new Map(current.chunks.map((chunk) => [chunk.n, chunk.games]));
  for (const n of write.deleted) sizes.delete(n);
  for (const chunk of write.chunks) sizes.set(chunk.n, chunk.games.length);
  const chunks = [...sizes].map(([n, games]) => ({ n, games })).sort((a, b) => a.n - b.n);
  const games = chunks.reduce((sum, chunk) => sum + chunk.games, 0);
  if (games > current.limit || chunks.length > chunkCap(current.limit)) {
    throw new HistoryError("invalid", `A history keeps at most ${current.limit.toLocaleString("en-US")} games.`);
  }
  // Each import's count can't be checked without every chunk, but the counts must add up, and
  // every game written must name an import on the list.
  const importIds = new Set(write.imports.map((entry) => entry.id));
  const listed = write.imports.reduce((sum, entry) => sum + entry.games, 0);
  if (
    importIds.size !== write.imports.length ||
    listed !== games ||
    write.chunks.some((chunk) => chunk.games.some((game) => !importIds.has(game.importId)))
  ) {
    throw new HistoryError("invalid", "The list of imports doesn't match the games.");
  }

  return {
    change: write,
    summary: {
      games,
      limit: current.limit,
      chunks,
      username: write.username,
      lastImportAt: at.toISOString(),
      imports: write.imports,
      version: current.version + 1,
    },
  };
}

/**
 * The imports after a merge: each earlier one less its removed games, gone when none are left,
 * then the new one when it added any.
 */
export function nextImports(imports: readonly HistoryImport[], report: MergeReport, added: HistoryImport): HistoryImport[] {
  const kept = imports
    .map((entry) => ({ ...entry, games: entry.games - (report.removedFrom[entry.id] ?? 0) }))
    .filter((entry) => entry.games > 0);
  return report.added ? [...kept, { ...added, games: report.added }] : kept;
}

/**
 * Merges an import's games into `history` and writes the chunks that changed, refused as stale
 * when the history changed after `version` was read, which the import read its stored keys at.
 * `name` is the file's, which the import is listed by.
 */
export async function saveImport(
  history: GameHistoryStore,
  incoming: readonly ReadGame[],
  { choice, username, version, name, at = new Date() }: { choice: LimitChoice; username: string; version: number; name: string; at?: Date },
): Promise<MergeReport> {
  const [summary, chunks] = await Promise.all([history.summary(), history.chunks()]);
  if (summary.version !== version) throw new HistoryError("stale", "The games changed in another tab. Import the file again.");
  // The version only grows, even across a deletion, so it numbers imports without repeats.
  const importId = summary.version + 1;
  const merged = mergeGames(chunks, incoming, { limit: summary.limit, choice, importId });
  if (!merged.report.written.length && !merged.report.deleted.length) return merged.report;
  const written = merged.chunks.filter((chunk) => merged.report.written.includes(chunk.n));
  const label = name.trim().slice(0, MAX_IMPORT_NAME_CHARS).trim() || "Games";
  const imports = nextImports(summary.imports, merged.report, { id: importId, at: at.toISOString(), name: label, username, games: 0 });
  await history.write({ chunks: written, deleted: merged.report.deleted, username, imports }, version);
  return merged.report;
}
