import { describe, expect, it } from "vitest";
import { buildViewTree, heavyLeaf, lineText, pathTo } from "@/lib/books/viewTree";
import { HISTORY_TAIL_PLIES, buildHistoryTree, gamesThrough, scoreOf, type PositionNames } from "./historyTree";
import type { GameRecord } from "./types";

let made = 0;
function game(moves: string, result: GameRecord["result"] = "win", color: GameRecord["color"] = "white"): GameRecord {
  const id = String(++made).padStart(8, "0");
  return {
    key: `lichess:${id}`,
    source: "lichess",
    id,
    playedAt: "2024-01-01",
    timeControl: "180+0",
    timeClass: "blitz",
    color,
    result,
    rating: null,
    opponentRating: null,
    moves,
    plies: moves.split(" ").length,
  };
}

describe("buildHistoryTree", () => {
  it("counts the games and the user's results at each position, heaviest move first", () => {
    const records = [
      game("e2e4 e7e5 g1f3", "win"),
      game("e2e4 e7e5 g1f3", "loss", "black"),
      game("e2e4 c7c5", "draw"),
      game("d2d4 d7d5", "win", "black"),
    ];
    const { source, results } = buildHistoryTree(records);
    const tree = buildViewTree(source);
    expect(tree.root.games).toBe(4);
    expect(results.get("root")).toEqual({ win: 2, draw: 1, loss: 1 });
    expect(tree.root.children.map((node) => [node.san, node.games])).toEqual([["e4", 3], ["d4", 1]]);
    const e4 = tree.root.children[0];
    expect(e4.children.map((node) => node.san)).toEqual(["e5", "c5"]);
    expect(results.get(e4.id)).toEqual({ win: 1, draw: 1, loss: 1 });
    expect(lineText(pathTo(heavyLeaf(tree.root)))).toBe("1.e4 e5 2.Nf3");
    expect(heavyLeaf(tree.root).fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
  });

  it(`draws ${HISTORY_TAIL_PLIES} ply of a line only one game took, then cuts it`, () => {
    const { source } = buildHistoryTree([game("e2e4 e7e5 g1f3 b8c6"), game("e2e4 e7e5 f1c4 g8f6")]);
    const tree = buildViewTree(source);
    const e5 = tree.root.children[0].children[0];
    expect(e5.games).toBe(2);
    for (const leaf of e5.children) expect(leaf.depth - e5.depth).toBe(HISTORY_TAIL_PLIES);
  });

  it("stops a line at a move the move player refuses", () => {
    const { source } = buildHistoryTree([game("e2e4 e2e4 g1f3"), game("e2e4 e2e4 g1f3")]);
    expect(buildViewTree(source).maxDepth).toBe(1);
  });

  it("names each position once across builds", () => {
    const names: PositionNames = new Map();
    const records = [game("e2e4 e7e5"), game("e2e4 e7e5"), game("d2d4 d7d5"), game("d2d4 d7d5")];
    buildHistoryTree(records, names);
    const first = names.get("e2e4 e7e5");
    buildHistoryTree(records.slice(0, 2), names);
    expect(names.size).toBe(4);
    expect(names.get("e2e4 e7e5")).toBe(first);
  });
});

describe("gamesThrough", () => {
  it("takes the games whose moves start with the line, whole moves only", () => {
    const records = [game("e2e4 e7e5"), game("a2a4 b7b5 a4b5 a7a5 b5b6 a5a4 b6b7 a4a3 b7a8q"), game("a2a4 b7b5 a4b5 a7a5 b5b6 a5a4 b6b7 a4a3 b7a8")].map(
      (record) => ({ record }),
    );
    expect(gamesThrough(records, "")).toHaveLength(3);
    expect(gamesThrough(records, "e2e4")).toEqual([records[0]]);
    expect(gamesThrough(records, "a2a4 b7b5 a4b5 a7a5 b5b6 a5a4 b6b7 a4a3 b7a8")).toEqual([records[2]]);
  });
});

describe("scoreOf", () => {
  it("counts a draw as half, and has none without games", () => {
    expect(scoreOf({ win: 1, draw: 2, loss: 1 })).toBe(0.5);
    expect(scoreOf({ win: 0, draw: 0, loss: 0 })).toBeNull();
  });
});
