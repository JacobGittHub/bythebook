// Reading a book's trees (bookstore.md D16). Until the views draw a book with several trees,
// they show the one from the starting position.

import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import type { MoveNode } from "@/types/chess";

const START_KEY = toPositionKey(START_FEN);

/** The tree from the starting position, or an empty one when the book has none there. */
export function startTree(trees: readonly MoveNode[]): MoveNode {
  return trees.find((tree) => toPositionKey(tree.fen) === START_KEY) ?? createRootMoveNode(START_FEN);
}

/** The book with `tree` in place of its tree from the starting position (added if it has none). */
export function withStartTree(trees: readonly MoveNode[], tree: MoveNode): MoveNode[] {
  const index = trees.findIndex((t) => toPositionKey(t.fen) === START_KEY);
  return index === -1 ? [tree, ...trees] : trees.map((t, i) => (i === index ? tree : t));
}
