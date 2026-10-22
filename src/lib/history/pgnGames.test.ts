import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commentClock, createGameReader, readGames, type RawGame } from "./pgnGames";
import { GAME_HISTORY_PLIES, MAX_HEADERS_PER_GAME, MAX_TOKENS_PER_GAME, MAX_VARIATION_DEPTH } from "./types";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const chesscom = fixture("chesscom.pgn");
const lichess = fixture("lichess.pgn");
const problems = (games: RawGame[]) => games.map((game) => game.problem);

describe("readGames on the fixtures", () => {
  it("reads every game, keeping the first plies and their clocks", () => {
    for (const [text, count] of [[chesscom, 19], [lichess, 9]] as const) {
      const { games, truncated } = readGames(text);
      expect(games).toHaveLength(count);
      expect(truncated).toBe(false);
      for (const game of games) {
        expect(game.problem).toBeNull();
        expect(game.sans).toHaveLength(Math.min(GAME_HISTORY_PLIES, game.plies));
        expect(game.clocks).toHaveLength(game.sans.length);
      }
    }
  });

  it("reads a Chess.com game's headers, moves and clocks", () => {
    const [game] = readGames(chesscom).games;
    expect(game.headers.get("Link")).toMatch(/^https:\/\/www\.chess\.com\/game\/live\/\d+$/);
    // 1. f4 {[%clk 0:04:59.9]} 1... d6 {[%clk 0:04:39.9]} 2. e4 {[%clk 0:04:58.4]} 1-0
    expect(game.sans).toEqual(["f4", "d6", "e4"]);
    expect(game.clocks).toEqual([2999, 2799, 2984]);
  });

  it("reads clocks among Lichess's evaluations", () => {
    const game = readGames(lichess).games.find((g) => g.headers.get("TimeControl") === "180+0")!;
    expect(game.clocks[0]).toBe(1800);
    expect(game.clocks.every((clock) => clock !== null)).toBe(true);
  });

  it("reads the same games however the file is split into pieces", () => {
    const whole = readGames(chesscom).games;
    for (const size of [1, 13, 4096]) {
      const games: RawGame[] = [];
      const reader = createGameReader((game) => games.push(game));
      for (let i = 0; i < chesscom.length; i += size) reader.push(chesscom.slice(i, i + size));
      reader.end();
      expect(games).toEqual(whole);
    }
  });

  it("reads headers only when asked for no plies", () => {
    const { games } = readGames(lichess, { plies: 0 });
    expect(games).toHaveLength(9);
    expect(games.every((game) => game.sans.length === 0 && game.plies > 0)).toBe(true);
  });

  it("stops at the most games a file may give, and says so", () => {
    const { games, truncated } = readGames(chesscom, { maxGames: 5 });
    expect(games).toHaveLength(5);
    expect(truncated).toBe(true);
    expect(readGames(lichess, { maxGames: 9 }).truncated).toBe(false);
  });
});

describe("readGames on hand-written games", () => {
  it("keeps the main line, skipping variations and their comments", () => {
    const [game] = readGames(
      '[Event "A"]\n\n1. e4 {[%clk 0:01:00]} (1. d4 {[%clk 0:00:01]} d5) 1... e5 $2 {[%clk 0:00:59]} 2. Nf3 *',
    ).games;
    expect(game.sans).toEqual(["e4", "e5", "Nf3"]);
    expect(game.clocks).toEqual([600, 590, null]);
    expect(game.plies).toBe(3);
  });

  it("splits games without headers at their results", () => {
    const { games } = readGames("1. e4 e5 1-0\n1. d4 d5 0-1\n1. c4");
    expect(games.map((game) => game.sans.join(" "))).toEqual(["e4 e5", "d4 d5", "c4"]);
  });

  it("keeps a header's first value", () => {
    const [game] = readGames('[White "A"]\n[White "B"]\n1. e4').games;
    expect(game.headers.get("White")).toBe("A");
  });

  it("reads clocks with and without hours and tenths", () => {
    expect(commentClock("[%clk 1:02:03]")).toBe(37230);
    expect(commentClock(" [%eval 0.3] [%clk 0:00:05.4] ")).toBe(54);
    expect(commentClock("[%clk x]")).toBeNull();
  });
});

describe("readGames on hostile files", () => {
  const next = '\n\n[Event "Next"]\n\n1. d4 d5 *';
  const lastIsFine = (games: RawGame[]) => {
    const last = games[games.length - 1];
    expect(last.headers.get("Event")).toBe("Next");
    expect(last.sans).toEqual(["d4", "d5"]);
    expect(last.problem).toBeNull();
  };

  it("marks a game with a huge comment and reads on", () => {
    const { games } = readGames(`[Event "A"]\n1. e4 {${"x".repeat(1_000_000)}} e5 *${next}`);
    expect(problems(games)).toEqual(["comment", null]);
    lastIsFine(games);
  });

  it("marks a game with an unclosed brace and reads on", () => {
    const { games } = readGames(`[Event "A"]\n1. e4 {unclosed e5 *${next}`);
    expect(problems(games)).toEqual(["comment", null]);
    lastIsFine(games);
  });

  it("marks a brace left open before any move without losing the next game", () => {
    const { games } = readGames(`[Event "A"]\n{unclosed${next}`);
    expect(problems(games)).toEqual(["comment", null]);
    lastIsFine(games);
  });

  it("marks unclosed and unopened brackets", () => {
    expect(problems(readGames(`[Event "A"]\n1. e4 (1. d4 e5 *${next}`).games)).toEqual(["brackets", null]);
    expect(problems(readGames(`[Event "A"]\n1. e4 ) e5 *${next}`).games)).toEqual(["brackets", null]);
  });

  it("marks variations nested too deep", () => {
    const deep = "(1. d4 ".repeat(MAX_VARIATION_DEPTH + 1) + ")".repeat(MAX_VARIATION_DEPTH + 1);
    const { games } = readGames(`[Event "A"]\n1. e4 ${deep} *${next}`);
    expect(problems(games)).toEqual(["variations", null]);
    lastIsFine(games);
  });

  it("marks a game of thousands of moves", () => {
    const { games } = readGames(`[Event "A"]\n${"Nf3 Nf6 Ng1 Ng8 ".repeat(MAX_TOKENS_PER_GAME)}*${next}`);
    expect(problems(games)).toEqual(["tokens", null]);
    expect(games[0].sans).toHaveLength(GAME_HISTORY_PLIES);
    lastIsFine(games);
  });

  it("marks a game with too many headers, or a broken one", () => {
    const headers = Array.from({ length: MAX_HEADERS_PER_GAME + 1 }, (_, i) => `[H${i} "x"]`).join("\n");
    expect(problems(readGames(`${headers}\n1. e4 *${next}`).games)).toEqual(["headers", null]);
    expect(problems(readGames(`[Event "A\n1. e4 *${next}`).games)).toEqual(["header", null]);
  });

  it("keeps a dangerous link as a plain header, for record.ts to refuse", () => {
    const [game] = readGames('[Site "javascript:alert(1)"]\n1. e4 *').games;
    expect(game.headers.get("Site")).toBe("javascript:alert(1)");
    expect(game.problem).toBeNull();
  });

  it("reads past odd characters and broken encodings", () => {
    const [game] = readGames('[White "Bj�rn\u0000"]\r\n\r\n1.\u0000e4 � e5 \u{1F600} 2. Nf3 *').games;
    expect(game.headers.get("White")).toBe("Bj�rn\u0000");
    expect(game.sans).toEqual(["e4", "e5", "Nf3"]);
  });

  it("reads nothing from an empty file or one of only comments", () => {
    expect(readGames("").games).toEqual([]);
    expect(readGames("{just a comment}\n; and a note").games).toEqual([]);
  });
});
