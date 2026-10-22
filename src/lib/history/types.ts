// A user's game history: their own games, imported from PGN files and kept as compact records
// (plans/game-history.md). A guest's are kept in the browser and an account's in the database,
// in chunks of up to `GAMES_PER_CHUNK`, in the order they were imported (D14, D15, D28).

import { z } from "zod";

/** The plies kept from the start of each game (D16). */
export const GAME_HISTORY_PLIES = 40;
/** Games per stored chunk, about 0.5 MB, well under a request's limit on Vercel (D15). */
export const GAMES_PER_CHUNK = 1_000;
/** Games kept per history, unless `account_limits` raises an account's (D18, D25). */
export const DEFAULT_GAME_HISTORY_LIMIT = 10_000;
/** The largest file the import reads (D13). */
export const MAX_GAME_FILE_BYTES = 100 * 1024 * 1024;
/** The most games read from one file; the rest of the file is left unread and reported. */
export const MAX_GAMES_PER_FILE = 50_000;
/** The most tokens (moves, comments, brackets…) one game may hold; a longer one is unreadable. */
export const MAX_TOKENS_PER_GAME = 5_000;
/** The deepest a variation may nest in a game. */
export const MAX_VARIATION_DEPTH = 32;
/** The most headers one game may have. */
export const MAX_HEADERS_PER_GAME = 64;
/** The longest a move may take, in tenths of a second (a day, for clocks that go wrong). */
export const MAX_MOVE_TENTHS = 864_000;
/** How long an import may run before it is stopped (D13), well past a slow phone's 10,000 games. */
export const IMPORT_TIME_LIMIT_MS = 10 * 60 * 1000;

export const GAME_SOURCES = ["chesscom", "lichess", "other"] as const;
export type GameSource = (typeof GAME_SOURCES)[number];

export const TIME_CLASSES = ["bullet", "blitz", "rapid", "classical", "daily", "unknown"] as const;
export type TimeClass = (typeof TIME_CLASSES)[number];

/** A game's id on its site: Chess.com's "live/123" or "daily/123", Lichess's eight characters. */
export const GAME_ID_PATTERNS: Record<Exclude<GameSource, "other">, RegExp> = {
  chesscom: /^(live|daily)\/\d{1,15}$/,
  lichess: /^[A-Za-z0-9]{8}$/,
};
/** The duplicate key (D23): the source and id, or a hash for a game without an id. */
export const GAME_KEY_PATTERN = /^(chesscom:(live|daily)\/\d{1,15}|lichess:[A-Za-z0-9]{8}|hash:[0-9a-f]{32})$/;
/** When a game was played: a UTC time, or only the day. */
export const PLAYED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/;
/** A PGN time control as `parseTimeControl` (`timeControl.ts`) reads it. */
export const TIME_CONTROL_PATTERN = /^[0-9+/:]{1,40}$/;
const UCI_LINE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?( [a-h][1-8][a-h][1-8][qrbn]?)*$/;

const ratingSchema = z.number().int().min(1).max(4000);

/** One game as it is kept (D8): no opponent's name, and moves as UCI text (D19). */
export const gameRecordSchema = z
  .object({
    key: z.string().regex(GAME_KEY_PATTERN),
    source: z.enum(GAME_SOURCES),
    /** The game's id on its site, which the game's link is built from; null for "other". */
    id: z.string().max(30).nullable(),
    playedAt: z.string().regex(PLAYED_AT_PATTERN).nullable(),
    /** The exact time control, such as "180+2", for viewing one on its own. */
    timeControl: z.string().regex(TIME_CONTROL_PATTERN).nullable(),
    timeClass: z.enum(TIME_CLASSES),
    color: z.enum(["white", "black"]),
    result: z.enum(["win", "draw", "loss"]),
    rating: ratingSchema.nullable(),
    opponentRating: ratingSchema.nullable(),
    /** The first `GAME_HISTORY_PLIES` plies, as UCI separated by spaces. */
    moves: z.string().max(GAME_HISTORY_PLIES * 6).regex(UCI_LINE_PATTERN),
    /** The whole game's length in plies, so a game that ended within `moves` can be told apart. */
    plies: z.number().int().min(1).max(MAX_TOKENS_PER_GAME),
  })
  .strict()
  .refine((game) => game.moves.split(" ").length <= Math.min(GAME_HISTORY_PLIES, game.plies), "Too many moves.")
  .refine(
    (game) =>
      game.source === "other"
        ? game.id === null
        : game.id === null || GAME_ID_PATTERNS[game.source].test(game.id),
    "The id doesn't match its source.",
  )
  .refine(
    (game) => (game.id === null ? game.key.startsWith("hash:") : game.key === `${game.source}:${game.id}`),
    "The key doesn't match the game's id.",
  );
export type GameRecord = z.infer<typeof gameRecordSchema>;

/** The time spent on each kept ply, in tenths of a second; empty when the file had no clocks. */
export const gameClocksSchema = z.array(z.number().int().min(0).max(MAX_MOVE_TENTHS)).max(GAME_HISTORY_PLIES);
export type GameClocks = z.infer<typeof gameClocksSchema>;

/** A record with its clocks, which are stored apart from it (D15). */
export type StoredGame = { record: GameRecord; clocks: GameClocks };

export const storedGameSchema = z
  .object({ record: gameRecordSchema, clocks: gameClocksSchema })
  .strict()
  .refine((game) => !game.clocks.length || game.clocks.length === game.record.moves.split(" ").length, "A clock for each move.");

/** The longest name kept as the user's (D22). */
export const MAX_USERNAME_CHARS = 100;

/**
 * Up to `GAMES_PER_CHUNK` games, in the order they were imported. Chunk numbers only grow: new
 * games fill the last chunk and then new ones, and dropping the earliest imported empties chunks
 * from the front, so an import rewrites only the chunks at either end (D28).
 */
export type StoredChunk = { n: number; games: StoredGame[] };

export const storedChunkSchema = z
  .object({
    n: z.number().int().min(0).max(1_000_000_000),
    games: z.array(storedGameSchema).min(1).max(GAMES_PER_CHUNK),
  })
  .strict();

/** What to do when an import holds more new games than the history has room for (D28). */
export type LimitChoice = "stop" | "replace";

/** A history's summary, which is read before any games are. */
export type HistorySummary = {
  /** Games kept. */
  games: number;
  /** The most games the history may keep (D18, D25). */
  limit: number;
  /** Each stored chunk's number and how many games it holds, in order. */
  chunks: { n: number; games: number }[];
  /** The name the last import read as the user's (D22). */
  username: string | null;
  lastImportAt: string | null;
  /** Goes up with every write, so a write planned from an older read is refused. */
  version: number;
};

/** One import's change to a history: the chunks written whole, and the chunks deleted. */
export type HistoryWrite = { chunks: StoredChunk[]; deleted: number[]; username: string };

export const historyWriteSchema = z
  .object({
    chunks: z.array(storedChunkSchema),
    deleted: z.array(z.number().int().min(0)),
    username: z.string().trim().min(1).max(MAX_USERNAME_CHARS),
  })
  .strict();

/**
 * Where a viewer's games are kept: this browser for a guest (D14), the account for a signed-in
 * viewer (D15). Writes check the version they were planned from, so two tabs importing at once
 * can't interleave.
 */
export type GameHistoryStore = {
  readonly store: "browser" | "account";
  summary(): Promise<HistorySummary>;
  /** Every chunk, in order. */
  chunks(): Promise<StoredChunk[]>;
  write(change: HistoryWrite, expectedVersion: number): Promise<HistorySummary>;
  /** Deletes every game. */
  clear(): Promise<void>;
};

/**
 * Why a history call failed: another tab or device wrote first, the write broke a rule (such as
 * the limit), or the store itself failed.
 */
export type HistoryErrorCode = "stale" | "invalid" | "failed";

export class HistoryError extends Error {
  constructor(
    readonly code: HistoryErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "HistoryError";
  }
}
