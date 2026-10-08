// Addresses into the pages that show a book: the Explorer with a book chosen and a line
// played, a book's own page in the Library, and a store book's page in the Bookstore.

import { Chess } from "chess.js";
import { EXAMPLE_ID_PREFIX } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import type { Move } from "@/types/chess";

/** A move in UCI, as the Explorer's `line` parameter carries it. */
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** The most moves a `line` parameter is read for, which bounds the replay. */
export const MAX_LINE_MOVES = 200;

/**
 * The Explorer with `bookId` chosen and `line` played from the starting position. `line` is the
 * path to a position, as the book views give it; its first position has no move and is skipped.
 */
export function explorerHref({
  bookId,
  line,
}: {
  bookId?: string | null;
  line?: readonly { uci: string | null }[];
}): string {
  const params = new URLSearchParams();
  if (bookId) params.set("book", bookId);
  const moves = (line ?? []).flatMap((node) => (node.uci ? [node.uci] : []));
  if (moves.length) params.set("line", moves.join(","));
  const query = params.toString();
  return query ? `/dashboard/explorer?${query}` : "/dashboard/explorer";
}

/** The `line` parameter's moves, up to the first that isn't UCI. */
export function parseLineParam(value: string | null | undefined): string[] {
  const moves: string[] = [];
  for (const move of (value ?? "").split(",").slice(0, MAX_LINE_MOVES)) {
    if (!UCI.test(move)) break;
    moves.push(move);
  }
  return moves;
}

/** UCI moves replayed from the starting position, up to the first that isn't legal there. */
export function replayUciLine(moves: readonly string[]): Move[] {
  const game = new Chess(START_FEN);
  const line: Move[] = [];
  for (const uci of moves) {
    try {
      const played = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      line.push({ san: played.san, uci: played.lan, fen: game.fen() });
    } catch {
      break;
    }
  }
  return line;
}

/** A book's own page, the Library's second level (plans/deployment.md D21). */
export function libraryBookHref(bookId: string): string {
  return `/dashboard/library/${encodeURIComponent(bookId)}`;
}

/** A store book's page. Its address drops the example books' id prefix. */
export function storeBookHref(storeId: string): string {
  const slug = storeId.startsWith(EXAMPLE_ID_PREFIX) ? storeId.slice(EXAMPLE_ID_PREFIX.length) : storeId;
  return `/dashboard/bookstore/${encodeURIComponent(slug)}`;
}

/** The store book id a Bookstore address names. */
export function storeIdOfSlug(slug: string): string {
  return `${EXAMPLE_ID_PREFIX}${decodeURIComponent(slug)}`;
}
