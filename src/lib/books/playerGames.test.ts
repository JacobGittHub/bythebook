import { describe, expect, it } from "vitest";
import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { applyUci } from "@/lib/chess/applyUci";
import { growBook } from "./grow";
import { coverage } from "./measures";
import { replaySanLines } from "./examples";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import {
  countPlayerMoves,
  gambitOf,
  isGambitName,
  playerGrowLookup,
  playerMovesLookup,
  openingOf,
} from "./playerGames";

const game = (moves: string) => ({ moves });

const keyAfter = (moves: string) =>
  toPositionKey(moves.split(" ").filter(Boolean).reduce((fen, uci) => applyUci(fen, uci)!, START_FEN));

describe("countPlayerMoves", () => {
  it("counts each move from its position, joining move orders that transpose", () => {
    const counts = countPlayerMoves([
      game("d2d4 g8f6 c2c4 e7e6"),
      game("c2c4 e7e6 d2d4 g8f6"),
      game("d2d4 g8f6 c2c4 g7g6"),
    ]);
    expect(counts.get(toPositionKey(START_FEN))).toEqual(new Map([["d2d4", 2], ["c2c4", 1]]));
    // 1.d4 Nf6 2.c4 e6 and 1.c4 e6 2.d4 Nf6 reach the same position.
    expect(counts.get(keyAfter("d2d4 g8f6 c2c4"))).toEqual(new Map([["e7e6", 1], ["g7g6", 1]]));
    expect(counts.get(keyAfter("c2c4 e7e6 d2d4"))).toEqual(new Map([["g8f6", 1]]));
  });

  it("stops a game at a move that isn't legal", () => {
    const counts = countPlayerMoves([game("e2e4 e2e4 d7d5")]);
    expect([...counts.keys()]).toEqual([toPositionKey(START_FEN)]);
  });
});

describe("a book grown from a player's games", () => {
  const games = [
    ...Array.from({ length: 6 }, () => game("e2e4 c7c6 d2d4 d7d5")),
    ...Array.from({ length: 3 }, () => game("e2e4 c7c6 b1c3 d7d5")),
    game("e2e4 e7e5 g1f3 b8c6"),
  ];
  const counts = countPlayerMoves(games);

  it("grows from the player's numbers", async () => {
    const result = await growBook(
      { root: ["e4"], side: "black", minShare: 0.2, minGames: 2, maxPly: 4, maxPositions: 100 },
      playerGrowLookup(counts),
    );
    expect([...result.lines].sort()).toEqual(["e4 c6 Nc3 d5", "e4 c6 d4 d5"]);
  });

  it("covers the player's games the book follows", () => {
    const tree = buildMoveTreeFromLines(replaySanLines(["e4 c6 d4 d5", "e4 c6 Nc3 d5"]).lines);
    const caught = coverage([tree], "black", playerMovesLookup(counts))!;
    // Every game played 1.e4; the one 1...e5 is Black's own move, which the book doesn't follow.
    expect(caught.covered + caught.escaped + caught.unknown).toBeCloseTo(1);
    expect(caught.covered).toBeCloseTo(1);
  });
});

describe("gambits", () => {
  it("doesn't count the Queen's Gambit family, but counts gambits inside it", () => {
    expect(isGambitName("Queen's Gambit Declined: Orthodox Defense")).toBe(false);
    expect(isGambitName("Queen's Gambit")).toBe(false);
    expect(isGambitName("Queen's Gambit Declined: Albin Countergambit")).toBe(true);
    expect(isGambitName("King's Gambit Accepted")).toBe(true);
  });

  it("names who offered a game's gambit", () => {
    expect(gambitOf(game("e2e4 e7e5 f2f4 e5f4"))).toMatchObject({ by: "white" });
    expect(gambitOf(game("e2e4 e7e5 g1f3 g8f6 f3e5 b8c6"))).toMatchObject({ by: "black" });
    expect(gambitOf(game("d2d4 d7d5 c2c4 e7e6"))).toBeNull();
  });

  it("names the opening a game ended up in by its deepest named position", () => {
    expect(openingOf(game("d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6"))).toBe("King's Indian Defense: Normal Variation");
    expect(openingOf(game("d2d4 g8f6 c2c4 g7g6 b1c3 d7d5"))).toBe("Grünfeld Defense");
    expect(openingOf(game("a2a3 a7a6 h2h3"))).toMatch(/^Anderssen/);
  });
});
