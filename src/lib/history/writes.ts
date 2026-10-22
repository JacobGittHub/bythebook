// The rules every write to a game history follows, so the browser's store (`browserHistory.ts`)
// accepts only what the account's routes will (D13, D28): records that pass their schema, chunks
// of at most `GAMES_PER_CHUNK`, no more games than the limit, no more chunks than the limit
// needs, plus one for a chunk left partly full at each end, and a list of imports that accounts
// for every game (D30). An account's commit is checked by the same rules from its staged chunks'
// sizes (`checkedCommit`).

import { mergeGames, type MergeReport } from "./merge";
import {
  GAMES_PER_CHUNK,
  HistoryError,
  MAX_IMPORT_NAME_CHARS,
  historyCommitSchema,
  historyWriteSchema,
  type GameHistoryStore,
  type HistoryCommit,
  type HistoryImport,
  type HistorySummary,
  type HistoryWrite,
  type LimitChoice,
  type ReadGame,
  type StoredChunk,
} from "./types";

/** A history with no games. */
export function emptySummary(limit: number): HistorySummary {
  return { games: 0, limit, chunks: [], username: null, lastImportAt: null, imports: [], version: 0, roomRequest: null };
}

/** The most chunks a history under `limit` needs: full ones, and a partial one at each end. */
export function chunkCap(limit: number): number {
  return Math.ceil(limit / GAMES_PER_CHUNK) + 1;
}

/** A chunk as a write is checked by: how many games it holds, and the imports they name. */
export type ChunkFacts = { n: number; games: number; importIds: readonly number[] };

/** The facts of a chunk whose games are at hand. */
export function chunkFacts(chunk: StoredChunk): ChunkFacts {
  return { n: chunk.n, games: chunk.games.length, importIds: [...new Set(chunk.games.map((game) => game.importId))] };
}

/**
 * The summary after a write that replaces the chunks `written` (by their facts) and deletes the
 * chunks `deleted`, made at `at`, or a refusal when it breaks a rule. It needs no games, so the
 * account's commit checks it from the sizes of the chunks it staged.
 */
function plannedSummary(
  current: HistorySummary,
  { written, deleted, username, imports }: { written: readonly ChunkFacts[]; deleted: readonly number[]; username: string; imports: HistoryImport[] },
  at: Date,
): HistorySummary {
  const numbers = written.map((chunk) => chunk.n);
  if (new Set(numbers).size !== numbers.length || numbers.some((n) => deleted.includes(n))) {
    throw new HistoryError("invalid", "A chunk is written twice, or written and deleted.");
  }
  const version = current.version + 1;
  const kept = new Map(current.chunks.map((chunk) => [chunk.n, chunk]));
  for (const n of deleted) kept.delete(n);
  for (const chunk of written) kept.set(chunk.n, { n: chunk.n, games: chunk.games, version });
  const chunks = [...kept.values()].sort((a, b) => a.n - b.n);
  const games = chunks.reduce((sum, chunk) => sum + chunk.games, 0);
  if (games > current.limit || chunks.length > chunkCap(current.limit)) {
    throw new HistoryError("invalid", `A history keeps at most ${current.limit.toLocaleString("en-US")} games.`);
  }
  // Each import's count can't be checked without every chunk, but the counts must add up, and
  // every game written must name an import on the list.
  const importIds = new Set(imports.map((entry) => entry.id));
  const listed = imports.reduce((sum, entry) => sum + entry.games, 0);
  if (importIds.size !== imports.length || listed !== games || written.some((chunk) => chunk.importIds.some((id) => !importIds.has(id)))) {
    throw new HistoryError("invalid", "The list of imports doesn't match the games.");
  }
  return { ...current, games, chunks, username, lastImportAt: at.toISOString(), imports, version };
}

/** `change` checked against the rules, and the summary after it, made at `at`. */
export function checkedWrite(current: HistorySummary, change: unknown, at: Date): { change: HistoryWrite; summary: HistorySummary } {
  const parsed = historyWriteSchema.safeParse(change);
  if (!parsed.success) throw new HistoryError("invalid", "Some of the games aren't valid, so nothing was saved.");
  const write = parsed.data;
  return { change: write, summary: plannedSummary(current, { ...write, written: write.chunks.map(chunkFacts) }, at) };
}

/**
 * An account's commit checked against the rules, from the facts of the chunks staged for it
 * (each checked against its schema when it was staged), and the summary after it.
 */
export function checkedCommit(
  current: HistorySummary,
  commit: unknown,
  staged: readonly ChunkFacts[],
  at: Date,
): { commit: HistoryCommit; summary: HistorySummary } {
  const parsed = historyCommitSchema.safeParse(commit);
  if (!parsed.success) throw new HistoryError("invalid", "The write isn't valid, so nothing was saved.");
  const byNumber = new Map(staged.map((chunk) => [chunk.n, chunk]));
  const written = parsed.data.written.map((n) => byNumber.get(n));
  if (written.some((chunk) => !chunk)) throw new HistoryError("stale", "Some of the games didn't arrive. Import the file again.");
  return { commit: parsed.data, summary: plannedSummary(current, { ...parsed.data, written: written as ChunkFacts[] }, at) };
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
