import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { toPositionKey } from "@/lib/chess/fen";
import { growBook, type GrowLookup, type GrowRules } from "./grow";

/** Master numbers for a few positions, keyed by the SAN line that reaches them. */
function lookupFrom(table: Record<string, Record<string, number>>): GrowLookup {
  const byKey = new Map<string, Record<string, number>>();
  for (const [line, moves] of Object.entries(table)) {
    const game = new Chess();
    for (const san of line.split(" ").filter(Boolean)) game.move(san);
    const uciMoves: Record<string, number> = {};
    for (const [san, games] of Object.entries(moves)) {
      const probe = new Chess(game.fen());
      uciMoves[probe.move(san).lan] = games;
    }
    byKey.set(toPositionKey(game.fen()), uciMoves);
  }
  return async (fen) => {
    const moves = byKey.get(toPositionKey(fen));
    if (!moves) return null;
    const list = Object.entries(moves).map(([uci, games]) => ({ uci, games }));
    return { moves: list, total: list.reduce((sum, move) => sum + move.games, 0) };
  };
}

const masters = lookupFrom({
  "d4 d5 c4": { e6: 500, c6: 300, dxc4: 150, Nc6: 30, e5: 20 },
  "d4 d5 c4 e6": { Nc3: 400, Nf3: 100 },
  "d4 d5 c4 c6": { Nf3: 200, Nc3: 100 },
  "d4 d5 c4 dxc4": { e4: 80, Nf3: 70 },
  "d4 d5 c4 e6 Nc3": { Nf6: 300, Be7: 100 },
});

const rules: GrowRules = {
  root: ["d4", "d5", "c4"],
  side: "white",
  minShare: 0.1,
  minGames: 50,
  maxPly: 12,
  maxPositions: 1_000,
};

describe("growBook", () => {
  it("plays the book's most played move and keeps the other side's common replies", async () => {
    const result = await growBook(rules, masters);
    expect(result.lines).toEqual([
      "d4 d5 c4 e6 Nc3 Nf6",
      "d4 d5 c4 e6 Nc3 Be7",
      "d4 d5 c4 c6 Nf3",
      "d4 d5 c4 dxc4 e4",
    ]);
    // The root line's 3 positions, then e6 c6 dxc4, Nc3 Nf3 e4, Nf6 Be7.
    expect(result.positions).toBe(11);
    expect(result.full).toBe(false);
    // After 3.Nf3 (c6) and 3.e4 (dxc4) and the two leaves after 3...Nf6 and 3...Be7.
    expect(result.unknown).toBe(4);
  });

  it("stops at the depth and the position limit", async () => {
    expect((await growBook({ ...rules, maxPly: 4 }, masters)).lines).toEqual([
      "d4 d5 c4 e6",
      "d4 d5 c4 c6",
      "d4 d5 c4 dxc4",
    ]);
    const capped = await growBook({ ...rules, maxPositions: 7 }, masters);
    expect(capped.positions).toBe(7);
    expect(capped.full).toBe(true);
  });

  it("keeps its seed lines' moves and adds the other side's missing replies", async () => {
    const result = await growBook({ ...rules, seedLines: ["d4 d5 c4 e6 Nf3"] }, masters);
    // White's seeded 3.Nf3 stays the book's move after 2...e6, so 3.Nc3 isn't added.
    expect(result.lines).toEqual(["d4 d5 c4 e6 Nf3", "d4 d5 c4 c6 Nf3", "d4 d5 c4 dxc4 e4"]);
  });

  it("gives the same book every time", async () => {
    const [a, b] = await Promise.all([growBook(rules, masters), growBook(rules, masters)]);
    expect(a).toEqual(b);
  });
});
