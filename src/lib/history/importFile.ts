// The two passes of an import (D13, D22, D28), each reading the file again as a stream so no
// more than a piece of it is held at once. The first reads every game's headers and moves
// without replaying them: how many games each name played, how many of those are new, and the
// keys and dates the second pass chooses from. The second replays only the games chosen for the
// user, the newest that fit, and gives their records. The import worker (`import.worker.ts`) runs
// both; they take a stream rather than a file so tests can run them in Node.

import { comparePlayed } from "./merge";
import { createGameReader, type RawGame } from "./pgnGames";
import { fileSkipReason, gameKey, gameSource, playedAt, playerColor, readRecord, type SkipReason } from "./record";
import { MAX_GAME_FILE_BYTES, type GameSource, type ReadGame } from "./types";

/** Why a file isn't read at all, in words the import can show, or null when it may be. */
export function fileProblem(name: string, size: number, firstBytes: Uint8Array): string | null {
  if (size === 0) return "The file is empty.";
  if (size > MAX_GAME_FILE_BYTES) {
    return `The file is larger than ${MAX_GAME_FILE_BYTES / 1024 / 1024} MB. Export fewer games at a time, such as a year's.`;
  }
  // Zip ("PK\3\4") and gzip (1F 8B) files, which some sites' exports come as, aren't opened (D13).
  const zipped = (firstBytes[0] === 0x50 && firstBytes[1] === 0x4b) || (firstBytes[0] === 0x1f && firstBytes[1] === 0x8b);
  if (zipped || /\.(zip|gz|bz2|7z)$/i.test(name)) return "The file is compressed. Unzip it and choose the .pgn file inside.";
  return null;
}

/** Reads `stream` as UTF-8, handing each piece of text to `onText` and waiting for it, with the bytes read so far. */
export async function readText(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string, bytes: number) => Promise<void> | void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    await onText(decoder.decode(value, { stream: true }), bytes);
  }
  const tail = decoder.decode();
  if (tail) await onText(tail, bytes);
}

/** Each game in `stream`, handed to `onGame` in order and waited for. */
async function eachGame(
  stream: ReadableStream<Uint8Array>,
  onGame: (game: RawGame) => Promise<void>,
  onBytes?: (bytes: number) => void,
): Promise<{ truncated: boolean }> {
  let batch: RawGame[] = [];
  const reader = createGameReader((game) => batch.push(game));
  const flush = async () => {
    const games = batch;
    batch = [];
    for (const game of games) await onGame(game);
  };
  await readText(stream, async (text, bytes) => {
    reader.push(text);
    await flush();
    onBytes?.(bytes);
  });
  reader.end();
  await flush();
  return { truncated: reader.truncated };
}

/** A name in the file: as first written, the games it played, and how many of those could be imported as new. */
export type NameCount = { name: string; games: number; fresh: number };

/** A new game that could be imported, for the second pass to choose from. Names are lower case. */
export type Candidate = { key: string; playedAt: string | null; white: string; black: string };

export type FileScan = {
  /** Games read. */
  games: number;
  /** Whether the file held more games than are read (`MAX_GAMES_PER_FILE`). */
  truncated: boolean;
  sources: Record<GameSource, number>;
  /** Games nobody could import, by reason. */
  skipped: Record<Exclude<SkipReason, "player">, number>;
  /** Games that could be imported but are stored already, or repeated in the file. */
  duplicates: number;
  /** Every name, the most games first. */
  names: NameCount[];
};

const lower = (name: string | undefined) => name?.trim().toLowerCase() ?? "";

/** The first pass: what the file holds, and the new games each name could import. */
export async function scanFile(
  stream: ReadableStream<Uint8Array>,
  storedKeys: ReadonlySet<string>,
  onBytes?: (bytes: number) => void,
): Promise<{ scan: FileScan; candidates: Candidate[] }> {
  const sources: Record<GameSource, number> = { chesscom: 0, lichess: 0, other: 0 };
  const skipped: FileScan["skipped"] = { variant: 0, unfinished: 0, noMoves: 0, unreadable: 0 };
  const names = new Map<string, NameCount>();
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  let games = 0;
  let duplicates = 0;

  const { truncated } = await eachGame(
    stream,
    async (game) => {
      games += 1;
      sources[gameSource(game.headers).source] += 1;
      const players = [...new Set([game.headers.get("White"), game.headers.get("Black")].map((name) => name?.trim() ?? ""))];
      const counts = players.filter((name) => name && name !== "?").map((name) => {
        const count = names.get(name.toLowerCase()) ?? { name, games: 0, fresh: 0 };
        count.games += 1;
        names.set(name.toLowerCase(), count);
        return count;
      });

      const skip = fileSkipReason(game);
      if (skip) {
        skipped[skip] += 1;
        return;
      }
      const key = await gameKey(game);
      if (storedKeys.has(key) || seen.has(key)) {
        duplicates += 1;
        return;
      }
      seen.add(key);
      for (const count of counts) count.fresh += 1;
      candidates.push({ key, playedAt: playedAt(game.headers), white: lower(game.headers.get("White")), black: lower(game.headers.get("Black")) });
    },
    onBytes,
  );

  const sorted = [...names.values()].sort((a, b) => b.games - a.games || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { scan: { games, truncated, sources, skipped, duplicates, names: sorted }, candidates };
}

/** The name that played the most games, which the import offers as the user's (D22). */
export function likelyUser(scan: FileScan): string | null {
  return scan.names[0]?.name ?? null;
}

/** How many new games `username` could import from the scan. */
export function freshFor(scan: FileScan, username: string): number {
  return scan.names.find((count) => count.name.toLowerCase() === lower(username))?.fresh ?? 0;
}

/** The keys of the newest `keep` candidates that `username` played. */
export function pickGames(candidates: readonly Candidate[], username: string, keep: number): Set<string> {
  const name = lower(username);
  const mine = candidates.filter((game) => name && (game.white === name || game.black === name)).sort(comparePlayed);
  return new Set(mine.slice(Math.max(0, mine.length - keep)).map((game) => game.key));
}

export type ImportResult = {
  /** The new games read for the user, which the merge adds. */
  games: ReadGame[];
  /** Games not imported, by reason; "player" counts games the user didn't play (D22). */
  skipped: Record<SkipReason, number>;
  /** The user's games already stored, or repeated in the file. */
  duplicates: number;
  /** The user's new games not read, for want of room. */
  leftOut: number;
};

/** The second pass: the records of the games in `wanted`, and why the others aren't kept. */
export async function importGames(
  stream: ReadableStream<Uint8Array>,
  { username, wanted, storedKeys }: { username: string; wanted: ReadonlySet<string>; storedKeys: ReadonlySet<string> },
  onGames?: (games: number) => void,
): Promise<ImportResult> {
  const skipped: Record<SkipReason, number> = { variant: 0, unfinished: 0, player: 0, noMoves: 0, unreadable: 0 };
  const games: ReadGame[] = [];
  const seen = new Set<string>();
  let count = 0;
  let duplicates = 0;
  let leftOut = 0;

  await eachGame(stream, async (game) => {
    count += 1;
    if (count % 100 === 0) onGames?.(count);
    const skip = fileSkipReason(game) ?? (playerColor(game.headers, username) ? null : "player");
    if (skip) {
      skipped[skip] += 1;
      return;
    }
    const key = await gameKey(game);
    if (storedKeys.has(key) || seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    if (!wanted.has(key)) {
      leftOut += 1;
      return;
    }
    const read = await readRecord(game, username);
    if (read.ok) games.push({ record: read.record, clocks: read.clocks });
    else skipped[read.reason] += 1;
  });
  onGames?.(count);
  return { games, skipped, duplicates, leftOut };
}

/** The share of a file's games that the user didn't play past which the report leads with them (D22). */
export const NAME_MISMATCH_SHARE = 0.1;

/**
 * The games left out because `username` didn't play them, whether that is a large part of the
 * file, and then the name with the most new games besides, which the report offers to import
 * as. A tournament file is mostly other people's games, so the offer is only a suggestion.
 */
export function nameMismatch(
  scan: FileScan,
  result: ImportResult,
  username: string,
): { games: number; large: boolean; other: NameCount | null } {
  const games = result.skipped.player;
  const large = games > 0 && games >= scan.games * NAME_MISMATCH_SHARE;
  const mine = lower(username);
  const other = large
    ? (scan.names.filter((count) => count.name.toLowerCase() !== mine && count.fresh > 0).sort((a, b) => b.fresh - a.fresh)[0] ?? null)
    : null;
  return { games, large, other };
}
