// The rules every write to a library follows, wherever the books are kept: a name of 1–30
// characters, trees that replay (`validate.ts`), a summary worked out from them (D26), and a
// change that names the `updatedAt` it read. The server applies them to rows
// (`src/lib/db/openings.ts`), and the browser library to IndexedDB records (`browserStore.ts`).

import type { MoveNode } from "@/types/chess";
import { checkBookName } from "./names";
import { summarize } from "./summary";
import { sameInstant } from "./time";
import { validateTrees } from "./validate";
import { LibraryError, bookOriginSchema, type BookDraft, type BookPatch, type LibraryBook, type LibraryEntry } from "./types";

/** Validated trees, or a `LibraryError` saying why they can't be stored. */
export function checkedTrees(input: unknown): MoveNode[] {
  const result = validateTrees(input);
  if (result.ok) return result.trees;
  if (result.reason === "over_limit") {
    throw new LibraryError("over_limit", `This book has ${result.count} positions; the limit is ${result.limit}.`);
  }
  throw new LibraryError("invalid", result.detail);
}

function checkedName(raw: unknown): string {
  const name = typeof raw === "string" ? checkBookName(raw) : null;
  if (name === null) throw new LibraryError("invalid", "A book's name is 1 to 30 characters.");
  return name;
}

function checkedColor(raw: unknown): BookDraft["color"] {
  if (raw !== "white" && raw !== "black") throw new LibraryError("invalid", "A book is for White or Black.");
  return raw;
}

/** A draft as it may be stored: its name cleaned, its origin and trees checked. */
export function checkedDraft(draft: BookDraft): BookDraft {
  const origin = bookOriginSchema.safeParse(draft.origin);
  if (!origin.success) throw new LibraryError("invalid", "The book's origin isn't one the library knows.");
  return {
    name: checkedName(draft.name),
    color: checkedColor(draft.color),
    origin: origin.data,
    trees: checkedTrees(draft.trees),
  };
}

/** A change as it may be stored. Fields it leaves out stay as they are. */
export function checkedPatch(patch: BookPatch): BookPatch {
  return {
    ...(patch.name !== undefined ? { name: checkedName(patch.name) } : {}),
    ...(patch.color !== undefined ? { color: checkedColor(patch.color) } : {}),
    ...(patch.trees !== undefined ? { trees: checkedTrees(patch.trees) } : {}),
  };
}

/**
 * The time to stamp a change made at `now`: strictly after `previous`, so two changes in the
 * same millisecond still differ and a tab holding the first is refused.
 */
export function nextUpdatedAt(previous: string, now: Date): string {
  const before = Date.parse(previous);
  const time = Number.isFinite(before) && now.getTime() <= before ? before + 1 : now.getTime();
  return new Date(time).toISOString();
}

/** A new book from a checked draft (`checkedDraft`). */
export function newBook(draft: BookDraft, id: string, now: Date): LibraryBook {
  return {
    id,
    name: draft.name,
    color: draft.color,
    origin: draft.origin,
    summary: summarize(draft.trees, draft.color),
    updatedAt: now.toISOString(),
    trees: draft.trees,
  };
}

/**
 * A book with a checked change (`checkedPatch`) applied, refused with `stale` unless it is
 * still the version read at `expectedUpdatedAt`. New trees or a new side give a new summary.
 */
export function patchedBook(book: LibraryBook, patch: BookPatch, expectedUpdatedAt: string, now: Date): LibraryBook {
  if (!sameInstant(book.updatedAt, expectedUpdatedAt)) throw new LibraryError("stale");
  const color = patch.color ?? book.color;
  const trees = patch.trees ?? book.trees;
  const resummarize = patch.trees !== undefined || color !== book.color;
  return {
    ...book,
    name: patch.name ?? book.name,
    color,
    trees,
    summary: resummarize ? summarize(trees, color) : book.summary,
    updatedAt: nextUpdatedAt(book.updatedAt, now),
  };
}

/** A book without its trees, as the list shows it. */
export function entryOf(book: LibraryBook): LibraryEntry {
  return {
    id: book.id,
    name: book.name,
    color: book.color,
    origin: book.origin,
    summary: book.summary,
    updatedAt: book.updatedAt,
  };
}

/** Newest change first, then by id, so the order never depends on how the books were read. */
export function byNewest(a: LibraryEntry, b: LibraryEntry): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
