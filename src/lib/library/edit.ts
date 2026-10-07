// Edits to a book's trees, and duplicating a book (plans/deployment.md D25). Each returns
// new trees and leaves its input alone; the library validates and summarizes on save.
// Renaming and changing side are plain patches (`names.ts` checks a name).

import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { cloneMoveTree, createRootMoveNode, mergeMoveLineIntoTree, removeMoveNodeById } from "@/lib/chess/moveTree";
import type { Move, MoveNode } from "@/types/chess";
import { copyName } from "./names";
import type { BookDraft, LibraryBook } from "./types";

/**
 * Adds a line of moves played from `fromFen`. It joins the tree that starts from that position
 * (bookstore.md D16), or starts a new tree when the book has none there.
 */
export function addLine(trees: readonly MoveNode[], moves: readonly Move[], fromFen: string = START_FEN): MoveNode[] {
  const key = toPositionKey(fromFen);
  const index = trees.findIndex((tree) => toPositionKey(tree.fen) === key);
  if (index === -1) return [...trees, mergeMoveLineIntoTree(createRootMoveNode(fromFen), [...moves])];
  return trees.map((tree, i) => (i === index ? mergeMoveLineIntoTree(tree, [...moves]) : tree));
}

/**
 * Removes a move and every position after it from the tree at `treeIndex`. A tree's first
 * position isn't a move, so naming it changes nothing.
 */
export function removeMove(trees: readonly MoveNode[], treeIndex: number, nodeId: string): MoveNode[] {
  return trees.map((tree, i) => (i === treeIndex && tree.id !== nodeId ? removeMoveNodeById(tree, nodeId) : tree));
}

/** A copy of a book to save as a new one, named so it doesn't clash with `takenNames`. */
export function duplicateBook(book: LibraryBook, takenNames: Iterable<string>): BookDraft {
  return {
    name: copyName(book.name, takenNames),
    color: book.color,
    origin: book.origin,
    trees: book.trees.map(cloneMoveTree),
  };
}
