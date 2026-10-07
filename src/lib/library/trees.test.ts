import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { startTree, withStartTree } from "./trees";

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("startTree and withStartTree", () => {
  const elsewhere = createRootMoveNode(AFTER_E4);
  const start = { ...createRootMoveNode(START_FEN), id: "start" };

  it("find the tree from the starting position, or give an empty one", () => {
    expect(startTree([elsewhere, start])).toBe(start);
    expect(startTree([elsewhere])).toEqual(createRootMoveNode(START_FEN));
  });

  it("replace that tree in place, or add it first", () => {
    const next = { ...start, id: "next" };
    expect(withStartTree([elsewhere, start], next)).toEqual([elsewhere, next]);
    expect(withStartTree([elsewhere], next)).toEqual([next, elsewhere]);
  });
});
