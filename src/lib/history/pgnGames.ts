// Reads a PGN file of many games, in pieces, into each game's headers, main-line moves and
// clocks (plans/game-history.md D13). It builds on the shared tokenizer
// (src/lib/chess/pgnTokens.ts), skips variations, comments other than clocks, and NAGs, and
// caps what one game or one file may hold. A game that breaks a cap is reported with its
// problem, and the games after it are still read. Moves are only collected here; `record.ts`
// replays them.

import { createPgnLexer, type PgnError, type PgnToken } from "@/lib/chess/pgnTokens";
import {
  GAME_HISTORY_PLIES,
  MAX_GAMES_PER_FILE,
  MAX_HEADERS_PER_GAME,
  MAX_TOKENS_PER_GAME,
  MAX_VARIATION_DEPTH,
} from "./types";

/**
 * Why a game couldn't be read: one of the tokenizer's errors, a bracket left open or closed
 * twice, variations nested too deep, or too many tokens or headers.
 */
export type GameProblem = PgnError | "brackets" | "variations" | "tokens" | "headers";

export type RawGame = {
  headers: ReadonlyMap<string, string>;
  /** The main line's first moves, as written, up to the reader's `plies`. */
  sans: string[];
  /** The clock left after each move in `sans`, in tenths of a second, or null where none is given. */
  clocks: (number | null)[];
  /** How many plies the main line has in all. */
  plies: number;
  problem: GameProblem | null;
};

export type GameReaderOptions = {
  /** How many main-line moves to keep per game; 0 reads headers only. */
  plies?: number;
  /** The most games read, after which the rest of the file is ignored. */
  maxGames?: number;
};

export type GameReader = {
  push(text: string): void;
  end(): void;
  /** Whether the file held more games than `maxGames`. */
  readonly truncated: boolean;
};

type Building = RawGame & {
  headers: Map<string, string>;
  depth: number;
  tokens: number;
  /** Whether the movetext has begun, after which a header starts the next game. */
  moved: boolean;
  /** Whether the main line's result has been read. */
  ended: boolean;
  /** Whether the last token was a kept main-line move, so a comment may give its clock. */
  afterKeptMove: boolean;
};

const CLOCK = /\[%clk\s+(\d{1,3}):(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]/;

/** The clock in a comment, in tenths of a second, or null. */
export function commentClock(comment: string): number | null {
  const match = CLOCK.exec(comment);
  if (!match) return null;
  return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 10);
}

/** A reader that hands each finished game to `onGame`. */
export function createGameReader(onGame: (game: RawGame) => void, options: GameReaderOptions = {}): GameReader {
  const keep = options.plies ?? GAME_HISTORY_PLIES;
  const maxGames = options.maxGames ?? MAX_GAMES_PER_FILE;
  let game: Building | null = null;
  let read = 0;
  let truncated = false;

  const finish = () => {
    if (!game) return;
    const { headers, sans, clocks, plies, depth } = game;
    const problem = game.problem ?? (depth > 0 ? "brackets" : null);
    if (headers.size || plies || problem) {
      onGame({ headers, sans, clocks, plies, problem });
      read += 1;
    }
    game = null;
  };

  /** Starts the next game, unless the file already gave its fill. */
  const start = (): Building | null => {
    finish();
    if (read >= maxGames) {
      truncated = true;
      return null;
    }
    game = {
      headers: new Map(),
      sans: [],
      clocks: [],
      plies: 0,
      problem: null,
      depth: 0,
      tokens: 0,
      moved: false,
      ended: false,
      afterKeptMove: false,
    };
    return game;
  };

  const onToken = (token: PgnToken) => {
    if (truncated) return;

    // A header after the movetext starts the next game; so does a broken header, which belongs
    // to the game it would have opened.
    if (token.kind === "header" || (token.kind === "error" && token.error === "header")) {
      const current = !game || game.moved ? start() : game;
      if (!current) return;
      if (token.kind === "error") current.problem ??= "header";
      else if (current.headers.size >= MAX_HEADERS_PER_GAME) current.problem ??= "headers";
      else if (!current.headers.has(token.name)) current.headers.set(token.name, token.value);
      return;
    }

    // Moves after a game's result, with no headers between, are the next game's.
    const current = !game || (game.ended && token.kind === "move") ? start() : game;
    if (!current) return;
    current.moved = true;
    if (current.problem || current.ended) return;

    current.tokens += 1;
    if (current.tokens > MAX_TOKENS_PER_GAME) {
      current.problem = "tokens";
      return;
    }

    const afterKeptMove = current.afterKeptMove;
    current.afterKeptMove = false;
    switch (token.kind) {
      case "move":
        if (current.depth > 0) break;
        current.plies += 1;
        if (current.sans.length < keep) {
          current.sans.push(token.san);
          current.clocks.push(null);
          current.afterKeptMove = true;
        }
        break;
      case "comment": {
        const last = current.clocks.length - 1;
        if (afterKeptMove && current.clocks[last] === null) current.clocks[last] = commentClock(token.text);
        current.afterKeptMove = afterKeptMove;
        break;
      }
      case "nag":
        current.afterKeptMove = afterKeptMove;
        break;
      case "open":
        current.depth += 1;
        if (current.depth > MAX_VARIATION_DEPTH) current.problem = "variations";
        break;
      case "close":
        if (current.depth === 0) current.problem = "brackets";
        else current.depth -= 1;
        break;
      case "result":
        if (current.depth === 0) current.ended = true;
        break;
      case "error":
        current.problem = token.error;
        break;
    }
  };

  const lexer = createPgnLexer(onToken);
  return {
    push: (text) => lexer.push(text),
    end: () => {
      lexer.end();
      if (!truncated) finish();
    },
    get truncated() {
      return truncated;
    },
  };
}

/** Every game in `text`, for text already in memory, such as a test's. */
export function readGames(text: string, options: GameReaderOptions = {}): { games: RawGame[]; truncated: boolean } {
  const games: RawGame[] = [];
  const reader = createGameReader((game) => games.push(game), options);
  reader.push(text);
  reader.end();
  return { games, truncated: reader.truncated };
}
