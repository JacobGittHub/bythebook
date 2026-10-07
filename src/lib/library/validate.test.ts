import { describe, expect, it } from "vitest";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { replaySanLines } from "@/lib/books/examples";
import { MAX_BOOK_POSITIONS, countPositions } from "@/lib/books/measures";
import { START_FEN } from "@/lib/chess/fen";
import { MAX_LINE_MOVES, legacyTrees, validateTrees } from "./validate";

const treeOf = (...lines: string[]) => buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN);
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function expectTrees(input: unknown) {
  const result = validateTrees(input);
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

describe("validateTrees", () => {
  it("keeps a good book as it is", () => {
    const tree = treeOf("e4 e5 Nf3", "e4 c5");
    const result = expectTrees([tree]);
    expect(result.trees).toEqual([tree]);
    expect(result.positions).toBe(4);
  });

  it("rebuilds positions, SAN and ids from the moves alone", () => {
    const input = [
      {
        fen: START_FEN,
        children: [{ id: "x", san: "Qh5", uci: "e2e4", fen: "8/8/8/8/8/8/8/8 w - - 0 1", children: [] }],
      },
    ];
    const [tree] = expectTrees(input).trees;
    expect(tree.id).toBe("root");
    expect(tree.children[0]).toMatchObject({ id: "root:e2e4", san: "e4", uci: "e2e4" });
    expect(tree.children[0].fen).toBe(AFTER_E4);
  });

  it("refuses an illegal move and says where it is", () => {
    const result = validateTrees([{ fen: START_FEN, children: [{ uci: "e2e4", children: [{ uci: "e2e4" }] }] }]);
    expect(result).toEqual({ ok: false, reason: "invalid", detail: "e2e4 isn't legal after e4." });
  });

  it("refuses moves that aren't UCI, bad FENs and wrong shapes", () => {
    for (const input of [
      [{ fen: START_FEN, children: [{ uci: "e4" }] }],
      [{ fen: "not a fen", children: [] }],
      [{ children: [] }],
      { fen: START_FEN },
      [{ fen: START_FEN, children: "e2e4" }],
      [null],
    ]) {
      expect(validateTrees(input)).toMatchObject({ ok: false, reason: "invalid" });
    }
  });

  it("merges repeated moves and trees from the same first position", () => {
    const input = [
      { fen: START_FEN, children: [{ uci: "e2e4", children: [{ uci: "e7e5" }] }, { uci: "e2e4", children: [{ uci: "c7c5" }] }] },
      { fen: "startpos", children: [{ uci: "d2d4" }] },
    ];
    const { trees } = expectTrees(input);
    expect(trees).toEqual([treeOf("e4 e5", "e4 c5", "d4")]);
  });

  it("keeps trees from other positions, drops empty ones, and leaves an empty book one tree", () => {
    const { trees } = expectTrees([
      { fen: START_FEN, children: [] },
      { fen: AFTER_E4, children: [{ uci: "c7c5" }] },
    ]);
    expect(trees.map((tree) => tree.fen)).toEqual([AFTER_E4]);
    expect(trees[0].children[0].san).toBe("c5");

    expect(expectTrees([]).trees).toEqual([{ id: "root", san: null, uci: null, fen: START_FEN, children: [] }]);
  });

  it("refuses a book over its limit with the count", () => {
    // Knights shuffling out and back give a line of any length, after White's first move.
    const shuffle = ["g8f6", "g1f3", "f6g8", "f3g1"];
    const line = (length: number) => {
      let node: Record<string, unknown> = {};
      const root = node;
      for (let i = 0; i < length; i++) {
        const child = { uci: shuffle[i % 4] };
        node.children = [child];
        node = child;
      }
      return { fen: START_FEN, children: root.children };
    };
    const lines = Math.ceil((MAX_BOOK_POSITIONS + 1) / 250);
    const input = Array.from({ length: lines }, (_, i) => ({
      fen: START_FEN,
      children: [{ uci: ["a2a3", "b2b3", "c2c3", "d2d3", "e2e3", "f2f3", "g2g3", "h2h3"][i % 8], children: line(249).children }],
    }));
    const result = validateTrees(input.slice(0, 4));
    expect(result.ok).toBe(true);
    expect(validateTrees(input)).toEqual({ ok: false, reason: "over_limit", count: 1_250, limit: MAX_BOOK_POSITIONS });
    expect(validateTrees(input, { verifiedPublisher: true }).ok).toBe(true);
    expect(validateTrees([line(MAX_LINE_MOVES + 1)])).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("legacyTrees", () => {
  it("reads a stored tree and the oldest rows' line arrays", () => {
    const tree = treeOf("d4 d5 c4");
    expect(expectTrees(legacyTrees(tree as never)).trees).toEqual([tree]);

    const lines = [[{ san: "d4", uci: "d2d4" }, { san: "d5", uci: "d7d5" }], [{ san: "e4", uci: "e2e4" }]];
    const fromLines = expectTrees(legacyTrees(lines)).trees;
    expect(countPositions(fromLines)).toBe(3);
    expect(fromLines[0].children[1].fen).toBe(AFTER_E4);

    expect(legacyTrees(null)).toEqual([]);
  });
});
