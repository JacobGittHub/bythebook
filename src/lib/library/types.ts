// A user's library: their books, kept in the browser for a guest and in the account for a
// beta tester (plans/deployment.md D12, D22–D26). Both stores implement `Library`, so pages
// don't care which one they have.

import { z } from "zod";
import { attributionSchema } from "@/lib/books/examples";
import type { BookSide } from "@/lib/books/measures";
import type { MoveNode } from "@/types/chess";

/** The most books one library holds, which also caps the list the server reads (D1). */
export const MAX_LIBRARY_BOOKS = 200;

/**
 * Where a book came from (D24), carried by every copy so a source's credit (such as
 * Wikibooks' CC BY-SA) travels with it.
 */
export const bookOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("own") }),
  z.object({
    kind: z.literal("store"),
    /** The publisher's name as the store showed it. */
    publisher: z.string().max(60),
    /** The store book it was saved from. */
    sourceId: z.string().max(100),
    /** Whom to credit, or null when the source needs no credit. */
    credit: attributionSchema.nullable(),
  }),
  z.object({
    kind: z.literal("combined"),
    /** The books it was combined from, for a later "Rebuild from sources" (bookstore.md D11). */
    sources: z.array(z.string().max(100)).max(MAX_LIBRARY_BOOKS),
  }),
  z.object({ kind: z.literal("import") }),
]);
export type BookOrigin = z.infer<typeof bookOriginSchema>;

/**
 * A book's miniature: its icicle down to blocks of a minimum share (`miniature.ts`). Shares
 * are whole units of `units`, the height of the whole book.
 */
export type Miniature = {
  units: number;
  /** The deepest block's depth, in moves: the miniature's width in columns. */
  depth: number;
  /** Each tree's band: `[start, span, ply of its first position]`. */
  trees: [number, number, number][];
  /** `[depth, start, span, family]`, each block after its parent. Family -1 is the trunk. */
  blocks: [number, number, number, number][];
};

/** What the book list shows without loading a tree (D26). */
export type BookSummary = {
  /** Bumped when the summary's shape or meaning changes, so old ones can be recomputed. */
  v: 1;
  positions: number;
  lines: number;
  trees: number;
  /** More than one tree, or one that starts elsewhere (bookstore.md D16). */
  unconnected: boolean;
  /** The average line length in moves, each leaf at its shortest move order (D9); null without moves. */
  averageDepth: number | null;
  /** The longest line, in moves. */
  maxDepth: number;
  /** Positions where the book's side has more than one move (bookstore.md D6). */
  clashes: number;
  miniature: Miniature;
};

/** A book as the list shows it. */
export type LibraryEntry = {
  id: string;
  name: string;
  color: BookSide;
  origin: BookOrigin;
  summary: BookSummary;
  /** ISO time of the last change; an update must name it (`Library.update`). */
  updatedAt: string;
};

/** A book with its trees, loaded when it opens. */
export type LibraryBook = LibraryEntry & { trees: MoveNode[] };

/** A book about to be saved. The store adds its id, summary and time. */
export type BookDraft = {
  name: string;
  color: BookSide;
  origin: BookOrigin;
  trees: MoveNode[];
};

export type BookPatch = Partial<Pick<BookDraft, "name" | "color" | "trees">>;

/**
 * Why a library refused a change. `stale`: the book changed since it was read (another tab or
 * device); `invalid` and `over_limit`: validation (`validate.ts`); `full`: the library has
 * `MAX_LIBRARY_BOOKS`; `failed`: anything else, such as the network.
 */
export type LibraryErrorCode = "stale" | "not_found" | "invalid" | "over_limit" | "full" | "failed";

export class LibraryError extends Error {
  constructor(
    readonly code: LibraryErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

const ERROR_SENTENCES: Record<LibraryErrorCode, string> = {
  stale: "This book changed in another tab or device.",
  not_found: "This book no longer exists.",
  invalid: "The book isn't valid, so it wasn't saved.",
  over_limit: "The book is over its position limit, so it wasn't saved.",
  full: `A library holds at most ${MAX_LIBRARY_BOOKS} books.`,
  failed: "Something went wrong. Please try again.",
};

/** What to tell the user about a failed library call: the store's own words, or a sentence for its code. */
export function libraryErrorMessage(error: unknown): string {
  if (!(error instanceof LibraryError)) return ERROR_SENTENCES.failed;
  return error.message && error.message !== error.code ? error.message : ERROR_SENTENCES[error.code];
}

export interface Library {
  /** Which store this is, which the Library names on screen (D23). */
  readonly store: "browser" | "account";
  /** Every book, newest change first. */
  list(): Promise<LibraryEntry[]>;
  get(id: string): Promise<LibraryBook | null>;
  create(draft: BookDraft): Promise<LibraryEntry>;
  /** Refused with `stale` unless the book's `updatedAt` is still `expectedUpdatedAt`. */
  update(id: string, patch: BookPatch, expectedUpdatedAt: string): Promise<LibraryEntry>;
  remove(id: string): Promise<void>;
}
