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
