// A signed-in user's game history (plans/game-history.md, Phase 3): the server side of the
// account's store. Reads run with the user's client, so the tables' access rules apply. Writes go
// through the migration's functions with the service role, which only these routes hold, after
// `writes.ts` has checked them, so the limit can't be skipped by writing to the tables directly.
// A write arrives as staged chunks, one request each, then a commit that names them.

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";
import { checkedCommit, chunkCap, emptySummary, type ChunkFacts } from "@/lib/history/writes";
import {
  DEFAULT_GAME_HISTORY_LIMIT,
  HistoryError,
  type GameClocks,
  type GameRecord,
  type HistoryCommit,
  type HistoryImport,
  type HistorySummary,
  type RoomRequest,
  type RoomRequestInput,
  type StoredChunk,
  type StoredGame,
} from "@/lib/history/types";
import type { Json } from "@/types/database";

/** A stored game as its chunk's `games` column keeps it; its clocks are in the `clocks` column. */
type KeptGame = { record: GameRecord; importId: number };

function failed(error: unknown): never {
  console.error("A game history query failed.", error);
  throw new HistoryError("failed", "The server couldn't read or keep the games.");
}

/** The games this account may keep: its `account_limits` row, or the default (D18). */
async function limitOf(userId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("account_limits").select("games").eq("user_id", userId).maybeSingle();
  if (error) failed(error);
  return data?.games ?? DEFAULT_GAME_HISTORY_LIMIT;
}

/** The account's latest request for more room (D37). */
async function latestRequest(userId: string): Promise<RoomRequest | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("game_limit_requests")
    .select("games, reason, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) failed(error);
  if (!data) return null;
  const status = data.status === "granted" || data.status === "declined" ? data.status : "pending";
  return { games: data.games, reason: data.reason, status, at: data.created_at };
}

/** The history's summary, its limit and the latest request for room; a history never written is empty. */
export async function readSummary(userId: string): Promise<HistorySummary> {
  const supabase = await createServerSupabaseClient();
  const [row, limit, roomRequest] = await Promise.all([
    supabase
      .from("game_history")
      .select("games, chunks, imports, username, last_import_at, version")
      .eq("user_id", userId)
      .maybeSingle(),
    limitOf(userId),
    latestRequest(userId),
  ]);
  if (row.error) failed(row.error);
  if (!row.data) return { ...emptySummary(limit), roomRequest };
  // The summary's lists were checked by `writes.ts` when they were written.
  return {
    games: row.data.games,
    limit,
    chunks: row.data.chunks as unknown as HistorySummary["chunks"],
    username: row.data.username,
    lastImportAt: row.data.last_import_at,
    imports: row.data.imports as unknown as HistoryImport[],
    version: row.data.version,
    roomRequest,
  };
}

/** One stored chunk with its clocks, or null when there is none numbered `n`. */
export async function readChunk(userId: string, n: number): Promise<StoredChunk | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("game_history_chunks")
    .select("games, clocks")
    .eq("user_id", userId)
    .eq("n", n)
    .maybeSingle();
  if (error) failed(error);
  if (!data) return null;
  const kept = data.games as unknown as KeptGame[];
  const clocks = data.clocks as unknown as GameClocks[];
  return { n, games: kept.map((game, i): StoredGame => ({ record: game.record, clocks: clocks[i] ?? [], importId: game.importId })) };
}

/**
 * Stages chunk `n` of a write planned from `expectedVersion`, its games already checked against
 * their schema. Refused as stale when the history has moved on.
 */
export async function stageChunk(userId: string, n: number, expectedVersion: number, games: StoredGame[]): Promise<void> {
  const limit = await limitOf(userId);
  const kept: KeptGame[] = games.map((game) => ({ record: game.record, importId: game.importId }));
  const { data, error } = await createAdminSupabaseClient().rpc("stage_game_history_chunk", {
    p_user_id: userId,
    p_base_version: expectedVersion,
    p_n: n,
    p_games: kept as unknown as Json,
    p_clocks: games.map((game) => game.clocks) as unknown as Json,
    p_game_count: games.length,
    p_import_ids: [...new Set(games.map((game) => game.importId))],
    p_cap: chunkCap(limit),
  });
  if (error) failed(error);
  if (data === "stale") throw new HistoryError("stale", "The games changed in another tab or device. Import the file again.");
  if (data !== "staged") throw new HistoryError("invalid", "The import sent more chunks than the history can hold.");
}

/** The facts of the chunks staged from `version`, which the commit is checked by. */
async function stagedFacts(userId: string, version: number): Promise<ChunkFacts[]> {
  const { data, error } = await createAdminSupabaseClient()
    .from("game_history_staged")
    .select("n, game_count, import_ids")
    .eq("user_id", userId)
    .eq("base_version", version);
  if (error) failed(error);
  return data.map((row) => ({ n: row.n, games: row.game_count, importIds: row.import_ids }));
}

/**
 * Commits a write planned from `expectedVersion`: its staged chunks replace the stored ones and
 * the summary is written, all at once. Refused as stale when the history has moved on.
 */
export async function commitWrite(userId: string, expectedVersion: number, commit: HistoryCommit): Promise<HistorySummary> {
  const current = await readSummary(userId);
  if (current.version !== expectedVersion) {
    throw new HistoryError("stale", "The games changed in another tab or device. Import the file again.");
  }
  const { summary } = checkedCommit(current, commit, await stagedFacts(userId, expectedVersion), new Date());
  const { data, error } = await createAdminSupabaseClient().rpc("commit_game_history", {
    p_user_id: userId,
    p_expected_version: expectedVersion,
    p_written: commit.written,
    p_deleted: commit.deleted,
    p_games: summary.games,
    p_chunks: summary.chunks as unknown as Json,
    p_imports: summary.imports as unknown as Json,
    p_username: summary.username ?? "",
    p_last_import_at: summary.lastImportAt ?? new Date().toISOString(),
    p_limit: summary.limit,
    p_cap: chunkCap(summary.limit),
  });
  // The function raises a check violation when the stored games don't match what was checked.
  if (error?.code === "23514") throw new HistoryError("invalid", "The games sent don't match the write, so nothing was saved.");
  if (error) failed(error);
  if (data === null) throw new HistoryError("stale", "The games changed in another tab or device. Import the file again.");
  return summary;
}

/** Deletes every game; the version keeps counting. */
export async function clearHistory(userId: string): Promise<void> {
  const { error } = await createAdminSupabaseClient().rpc("clear_game_history", { p_user_id: userId });
  if (error) failed(error);
}

/** Asks for more room (D37), refused while another request is pending. */
export async function requestRoom(userId: string, request: RoomRequestInput): Promise<RoomRequest> {
  const { data, error } = await createAdminSupabaseClient()
    .from("game_limit_requests")
    .insert({ user_id: userId, games: request.games, reason: request.reason })
    .select("created_at")
    .single();
  // The unique index allows one pending request per account.
  if (error?.code === "23505") throw new HistoryError("invalid", "You've already asked for more room. The request is waiting for an answer.");
  if (error) failed(error);
  return { ...request, status: "pending", at: data.created_at };
}
