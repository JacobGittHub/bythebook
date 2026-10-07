// A book's summary (plans/deployment.md D26): what the book list shows without loading its
// trees. The browser works it out on save and the server recomputes it while validating, so
// a client can't misreport it. The numbers come from `src/lib/books/measures.ts`.

import {
  averageLeafDepth,
  countPositions,
  findClashes,
  hasUnconnectedLines,
  type BookSide,
} from "@/lib/books/measures";
import type { MoveNode } from "@/types/chess";
import { miniature } from "./miniature";
import type { BookSummary } from "./types";

/** Lines in a book: its leaves, each move order counted. */
export function countLines(trees: readonly MoveNode[]): number {
  const count = (node: MoveNode, depth: number): number =>
    node.children.length ? node.children.reduce((sum, child) => sum + count(child, depth + 1), 0) : depth > 0 ? 1 : 0;
  return trees.reduce((sum, tree) => sum + count(tree, 0), 0);
}

/** The longest line, in moves from its tree's first position. */
export function deepestLine(trees: readonly MoveNode[]): number {
  const depth = (node: MoveNode): number =>
    node.children.reduce((deepest, child) => Math.max(deepest, 1 + depth(child)), 0);
  return trees.reduce((deepest, tree) => Math.max(deepest, depth(tree)), 0);
}

export function summarize(trees: readonly MoveNode[], side: BookSide): BookSummary {
  return {
    v: 1,
    positions: countPositions(trees),
    lines: countLines(trees),
    trees: trees.length,
    unconnected: hasUnconnectedLines(trees),
    averageDepth: averageLeafDepth(trees),
    maxDepth: deepestLine(trees),
    clashes: findClashes(trees, side).length,
    miniature: miniature(trees),
  };
}
