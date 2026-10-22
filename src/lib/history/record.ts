// One game read from a file (`pgnGames.ts`), turned into the record that is kept (D8): who the
// user was, the result from their side, the first plies replayed with chess.js into UCI, and
// the time spent on each. Nothing a header says is trusted: an id is taken only through a strict
// pattern, a link is built from it rather than copied, and opponents' names go no further than
// the duplicate key's hash.

import { Chess } from "chess.js";
import type { RawGame } from "./pgnGames";
import { parseTimeControl, timeClassOf, type TimeControl } from "./timeControl";
import {
  GAME_HISTORY_PLIES,
  GAME_ID_PATTERNS,
  MAX_MOVE_TENTHS,
  type GameClocks,
  type GameRecord,
  type GameSource,
} from "./types";

/**
 * Why a game isn't kept: Chess960 or a set-up position (D7), unfinished, no player with the
 * user's name (D22), no moves, or a problem reading it, such as an illegal move.
 */
export type SkipReason = "variant" | "unfinished" | "player" | "noMoves" | "unreadable";

export type RecordRead = { ok: true; record: GameRecord; clocks: GameClocks } | { ok: false; reason: SkipReason };

const CHESSCOM_LINK = /^https:\/\/www\.chess\.com\/(?:game\/(live|daily)|(live|daily)\/game)\/(\d{1,15})$/;
const LICHESS_SITE = /^https:\/\/lichess\.org\/([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?$/;

/** The site a game came from, and its id there when a header gives one in the expected form. */
export function gameSource(headers: ReadonlyMap<string, string>): { source: GameSource; id: string | null } {
  const site = headers.get("Site")?.trim() ?? "";
  const link = headers.get("Link")?.trim() ?? "";
  if (site.toLowerCase() === "chess.com" || link.startsWith("https://www.chess.com/")) {
    const match = CHESSCOM_LINK.exec(link);
    return { source: "chesscom", id: match ? `${match[1] ?? match[2]}/${match[3]}` : null };
  }
  if (site.startsWith("https://lichess.org/")) {
    const gameId = headers.get("GameId")?.trim() ?? "";
    const id = GAME_ID_PATTERNS.lichess.test(gameId) ? gameId : (LICHESS_SITE.exec(site)?.[1] ?? null);
    return { source: "lichess", id };
  }
  return { source: "other", id: null };
}

/** The game's page on its site, built from its id, or null for a game without one. */
export function gameLink(record: Pick<GameRecord, "source" | "id" | "color">): string | null {
  if (record.id === null) return null;
  if (record.source === "chesscom" && GAME_ID_PATTERNS.chesscom.test(record.id)) {
    return `https://www.chess.com/game/${record.id}`;
  }
  if (record.source === "lichess" && GAME_ID_PATTERNS.lichess.test(record.id)) {
    return `https://lichess.org/${record.id}${record.color === "black" ? "/black" : ""}`;
  }
  return null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The duplicate key (D23): the source and id, or for a game without an id a hash of when it was
 * played, both names, the result, its length and its first `GAME_HISTORY_PLIES` moves as written,
 * so it needs a game read with at least those plies. Reading the same file twice gives the same
 * keys, so nothing is stored twice.
 */
export async function gameKey(game: RawGame): Promise<string> {
  const { source, id } = gameSource(game.headers);
  if (id !== null) return `${source}:${id}`;
  const fields = ["Date", "UTCDate", "UTCTime", "Round", "White", "Black", "Result"].map(
    (name) => game.headers.get(name)?.trim() ?? "",
  );
  const moves = game.sans.slice(0, GAME_HISTORY_PLIES).join(" ");
  return `hash:${(await sha256Hex(JSON.stringify([...fields, game.plies, moves]))).slice(0, 32)}`;
}

/** The side the user played, matching the name without regard to case, or null if neither. */
export function playerColor(headers: ReadonlyMap<string, string>, username: string): "white" | "black" | null {
  const name = username.trim().toLowerCase();
  if (!name) return null;
  if (headers.get("White")?.trim().toLowerCase() === name) return "white";
  if (headers.get("Black")?.trim().toLowerCase() === name) return "black";
  return null;
}

/** "2020.05.22" as "2020-05-22", or null for a date that is partly unknown or not a date. */
function isoDate(date: string | undefined): string | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(date?.trim() ?? "");
  if (!match) return null;
  const [month, day] = [Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** When the game was played: its UTC date and time, or its date alone. */
export function playedAt(headers: ReadonlyMap<string, string>): string | null {
  const utcDate = isoDate(headers.get("UTCDate"));
  const utcTime = headers.get("UTCTime")?.trim() ?? "";
  if (utcDate && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(utcTime)) return `${utcDate}T${utcTime}Z`;
  return utcDate ?? isoDate(headers.get("Date"));
}

function rating(value: string | undefined): number | null {
  const n = /^\d{1,4}$/.test(value?.trim() ?? "") ? Number(value) : NaN;
  return n >= 1 && n <= 4000 ? n : null;
}

/**
 * The time spent on each ply, in tenths of a second, from the clock left after it: the side's
 * clock before the move, less the clock after, plus the increment. Lichess starts each side's
 * clock only after its first move, so those count as none. Empty when any clock is missing or
 * the game had no clock.
 */
export function timeSpent(clocks: readonly (number | null)[], control: TimeControl | null, source: GameSource): GameClocks {
  if (control?.kind !== "clock" || !clocks.length || clocks.some((clock) => clock === null)) return [];
  const left = clocks as number[];
  const [base, increment] = [control.base * 10, control.increment * 10];
  return left.map((now, ply) => {
    if (ply < 2 && source === "lichess") return 0;
    const before = ply < 2 ? base : left[ply - 2];
    return Math.min(MAX_MOVE_TENTHS, Math.max(0, before - now + increment));
  });
}

/** The game's moves replayed into UCI, or null at the first move chess.js won't play. */
function replay(sans: readonly string[]): string[] | null {
  const chess = new Chess();
  const moves: string[] = [];
  for (const san of sans) {
    try {
      moves.push(chess.move(san).lan);
    } catch {
      return null;
    }
  }
  return moves;
}

/**
 * Why a game can't be kept whoever the user is, found without replaying it, or null when it may
 * be. The first pass counts the games each name could import with it (D22).
 */
export function fileSkipReason(game: RawGame): Exclude<SkipReason, "player"> | null {
  const { headers } = game;
  if (game.problem) return "unreadable";
  const variant = headers.get("Variant")?.trim().toLowerCase();
  if ((variant && variant !== "standard") || headers.get("SetUp")?.trim() === "1" || headers.has("FEN")) {
    return "variant";
  }
  const result = headers.get("Result")?.trim();
  if (result !== "1-0" && result !== "0-1" && result !== "1/2-1/2") return "unfinished";
  if (!game.sans.length) return "noMoves";
  return null;
}

/**
 * The record kept for a game the user played as `username`, or why it isn't kept. A game with
 * an illegal move among its kept plies is unreadable rather than cut short, so a game is never
 * taken to have ended where it didn't.
 */
export async function readRecord(game: RawGame, username: string): Promise<RecordRead> {
  const { headers } = game;
  const skip = fileSkipReason(game);
  if (skip) return { ok: false, reason: skip };
  const color = playerColor(headers, username);
  if (!color) return { ok: false, reason: "player" };
  const result = headers.get("Result")?.trim();
  const moves = replay(game.sans.slice(0, GAME_HISTORY_PLIES));
  if (!moves) return { ok: false, reason: "unreadable" };

  const { source, id } = gameSource(headers);
  const control = parseTimeControl(headers.get("TimeControl"));
  const [mine, theirs] = color === "white" ? ["WhiteElo", "BlackElo"] : ["BlackElo", "WhiteElo"];
  const record: GameRecord = {
    key: await gameKey(game),
    source,
    id,
    playedAt: playedAt(headers),
    timeControl: control?.text ?? null,
    timeClass: timeClassOf(control, source, headers.get("Event")),
    color,
    result: result === "1/2-1/2" ? "draw" : (result === "1-0") === (color === "white") ? "win" : "loss",
    rating: rating(headers.get(mine)),
    opponentRating: rating(headers.get(theirs)),
    moves: moves.join(" "),
    plies: game.plies,
  };
  return { ok: true, record, clocks: timeSpent(game.clocks.slice(0, moves.length), control, source) };
}
