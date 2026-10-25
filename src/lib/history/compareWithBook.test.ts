import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { buildViewTree } from "@/lib/books/viewTree";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { compareWithBook } from "./compareWithBook";
import type { GameRecord } from "./types";

let made = 0;
function game(moves: string, result: GameRecord["result"] = "win", options: Partial<GameRecord> = {}): GameRecord {
  const id = String(++made).padStart(8, "0");
  return {
    key: `lichess:${id}`,
    source: "lichess",
    id,
    playedAt: "2024-01-01",
    timeControl: "180+0",
    timeClass: "blitz",
    color: "white",
    result,
    rating: null,
    opponentRating: null,
    moves,
    plies: moves.split(" ").length,
    ...options,
  };
}

// A White book: 1.d4 Nf6 2.c4 e6 3.Nc3, and 1.d4 d5 2.c4.
const book = buildViewTree(buildMoveTreeFromLines(replaySanLines(["d4 Nf6 c4 e6 Nc3", "d4 d5 c4"]).lines, START_FEN));

describe("compareWithBook", () => {
  it("counts games and results at each book position, and the games of the other side not at all", () => {
    const result = compareWithBook(book, "white", [
      game("d2d4 g8f6 c2c4 e7e6 b1c3 f8b4", "win"),
      game("d2d4 g8f6 c2c4 e7e6 b1c3", "loss"),
      game("e2e4 e7e5", "draw", { color: "black" }),
    ]);
    expect(result.games).toBe(2);
    expect(result.totals.get("root")).toEqual({ games: 2, win: 1, draw: 0, loss: 1 });
    expect(result.totals.get("root:d2d4:g8f6:c2c4:e7e6:b1c3")).toEqual({ games: 2, win: 1, draw: 0, loss: 1 });
    expect(result.reachedEnd).toBe(2);
    expect(result.exits).toEqual([]);
  });

  it("records where games leave and who left: the user, or an opponent the book doesn't answer", () => {
    const result = compareWithBook(book, "white", [
      game("d2d4 g8f6 g1f3", "loss"),
      game("d2d4 g8f6 g1f3", "loss"),
      game("d2d4 c7c5", "win"),
    ]);
    expect(result.exits.map((exit) => [exit.from.id, exit.san, exit.by, exit.games])).toEqual([
      ["root:d2d4:g8f6", "Nf3", "you", 2],
      ["root:d2d4", "c5", "opponent", 1],
    ]);
    expect(result.exits[0].tally).toEqual({ win: 0, draw: 0, loss: 2 });
  });

  it("rejoins the book where another move order reaches one of its positions (D27)", () => {
    // 1.c4 Nf6 2.d4 reaches the book's 1.d4 Nf6 2.c4.
    const result = compareWithBook(book, "white", [game("c2c4 g8f6 d2d4 e7e6 b1c3")]);
    expect(result.transposed).toBe(1);
    expect(result.exits).toEqual([]);
    expect(result.reachedEnd).toBe(1);
    expect(result.totals.get("root:d2d4:g8f6:c2c4:e7e6")?.games).toBe(1);
  });

  it("tells a game that ended inside the book from one whose kept moves stop there", () => {
    const result = compareWithBook(book, "white", [game("d2d4 g8f6"), game("d2d4 g8f6", "win", { plies: 80 })]);
    expect(result.endedInside).toBe(1);
    expect(result.toCutoff).toBe(1);
  });

  it("works for a Black book", () => {
    const black = buildViewTree(buildMoveTreeFromLines(replaySanLines(["e4 c5 Nf3 d6"]).lines, START_FEN));
    const result = compareWithBook(black, "black", [game("e2e4 c7c5 g1f3 b8c6", "draw", { color: "black" })]);
    expect(result.exits.map((exit) => [exit.san, exit.by])).toEqual([["Nc6", "you"]]);
  });
});
