// Finding books in a list by name and side (the Library's search, plans/deployment.md D21).

import type { BookSide } from "@/lib/books/measures";
import { cleanBookName } from "./names";

export type SideFilter = "all" | BookSide;

/** The books whose name holds `query` (ignoring case and extra spaces) and that `side` allows. */
export function filterBooks<T extends { name: string; color: BookSide }>(
  books: readonly T[],
  query: string,
  side: SideFilter,
): T[] {
  const wanted = cleanBookName(query).toLocaleLowerCase();
  return books.filter(
    (book) => (side === "all" || book.color === side) && (!wanted || book.name.toLocaleLowerCase().includes(wanted)),
  );
}

/**
 * The Bookstore's search and filters (plans/book-ui.md D9). They travel in its addresses, so
 * a store book's page lists the shelf as they left it, and the way back keeps them.
 */
export type ShelfFilters = { query: string; side: SideFilter; verifiedOnly: boolean };

/** The whole shelf: no search, either side, any publisher. */
export const WHOLE_SHELF: ShelfFilters = { query: "", side: "all", verifiedOnly: false };

/** The longest search an address is read for. */
export const MAX_SHELF_QUERY = 100;

type ShelfParams = { q?: string | string[]; side?: string | string[]; verified?: string | string[] };
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** The filters an address's `q`, `side` and `verified` name; anything else is the whole shelf's. */
export function parseShelf(params: ShelfParams): ShelfFilters {
  const side = one(params.side);
  return {
    query: one(params.q).slice(0, MAX_SHELF_QUERY),
    side: side === "white" || side === "black" ? side : "all",
    verifiedOnly: one(params.verified) === "1",
  };
}

/** The filters as an address's query, "" for the whole shelf; `parseShelf` reads it back. */
export function shelfQuery(shelf: ShelfFilters): string {
  const params = new URLSearchParams();
  if (shelf.query.trim()) params.set("q", shelf.query);
  if (shelf.side !== "all") params.set("side", shelf.side);
  if (shelf.verifiedOnly) params.set("verified", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}
