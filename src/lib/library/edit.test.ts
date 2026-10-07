import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { countPositions } from "@/lib/books/measures";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines, createRootMoveNode } from "@/lib/chess/moveTree";
import { addLine, duplicateBook, removeMove } from "./edit";
import { summarize } from "./summary";

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const movesOf = (line: string) => replaySanLines([line]).lines[0];

describe("book edits", () => {
  const tree = buildMoveTreeFromLines([movesOf("d4 d5 c4")], START_FEN);

  it("add a line to the tree from its first position, or as a new tree", () => {
    const joined = addLine([tree], movesOf("d4 Nf6"));
    expect(joined).toHaveLength(1);
    expect(countPositions(joined)).toBe(4);
    expect(countPositions([tree])).toBe(3);

    const apart = addLine([tree], [{ san: "c5", uci: "c7c5" }], AFTER_E4);
    expect(apart.map((t) => t.fen)).toEqual([START_FEN, AFTER_E4]);
  });

  it("remove a move with everything after it, but never a tree's first position", () => {
    expect(countPositions(removeMove([tree], 0, "root:d2d4:d7d5"))).toBe(1);
    expect(removeMove([tree], 0, "root")).toEqual([tree]);
    expect(removeMove([tree], 1, "root:d2d4")).toEqual([tree]);
  });

  it("duplicate a book under a free name, with its origin", () => {
    const trees = [tree];
    const book = {
      id: "a",
      name: "QG",
      color: "white" as const,
      origin: { kind: "import" as const },
      summary: summarize(trees, "white"),
      updatedAt: "",
      trees,
    };
    const copy = duplicateBook(book, ["QG"]);
    expect(copy).toEqual({ name: "QG (copy)", color: "white", origin: { kind: "import" }, trees });
    expect(copy.trees[0]).not.toBe(tree);
    expect(duplicateBook({ ...book, trees: [createRootMoveNode()] }, []).name).toBe("QG (copy)");
  });
});
