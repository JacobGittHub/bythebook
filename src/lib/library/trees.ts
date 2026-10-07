// Reading a book's trees (bookstore.md D16). Until the views draw a book with several trees,
// they show the one from the starting position, and the pages that edit a book edit that one.

import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import type { MoveNode } from "@/types/chess";
import { LibraryError, type Library, type LibraryBook } from "./types";

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

/** What a page tells the user when its copy of a book was out of date. */
export const STALE_BOOK_MESSAGE = "This book changed in another tab or device, so it was reloaded. Please make your change again.";

/**
 * Saves `tree` as the book's tree from the starting position. If the book changed elsewhere
 * since it was read, nothing is saved and the current book comes back with `saved: false`,
 * so the page can show it rather than keep a copy that can't save.
 */
export async function saveStartTree(
  library: Library,
  book: LibraryBook,
  tree: MoveNode,
): Promise<{ book: LibraryBook; saved: boolean }> {
  const trees = withStartTree(book.trees, tree);
  try {
    const entry = await library.update(book.id, { trees }, book.updatedAt);
    return { book: { ...entry, trees }, saved: true };
  } catch (error) {
    if (!(error instanceof LibraryError && error.code === "stale")) throw error;
    const current = await library.get(book.id);
    if (!current) throw new LibraryError("not_found");
    return { book: current, saved: false };
  }
}
