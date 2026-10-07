// A signed-in user's books in `opening_books` (plans/deployment.md D22–D26): the server side
// of the account library. Every query runs with the user's client, so the table's access
// rules apply, and names the user, since "read public books" also lets anyone read a public
// one. Writes validate and summarize here, so a client can't store a bad tree or misreport its
// summary.
//
// Until the old books move (deployment.md Phase 5, step 9), a row may lack `trees` and
// `summary`: reads then rebuild them from `move_node`, and every write also stores the tree
// from the starting position in `move_node`, so the previous code still reads it.

import { createServerSupabaseClient } from "@/lib/supabase";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { summarize } from "@/lib/library/summary";
import {
  LibraryError,
  MAX_LIBRARY_BOOKS,
  bookOriginSchema,
  type BookOrigin,
  type BookSummary,
  type LibraryBook,
  type LibraryEntry,
} from "@/lib/library/types";
import { sameInstant } from "@/lib/library/time";
import { startTree } from "@/lib/library/trees";
import { legacyTrees, validateTrees } from "@/lib/library/validate";
import type { MoveNode } from "@/types/chess";
import type { Json, Tables } from "@/types/database";

type BookRow = Tables<"opening_books">;

const ENTRY_COLUMNS = "id, name, color, origin, summary, updated_at";
const BOOK_COLUMNS = `${ENTRY_COLUMNS}, trees, move_node`;

type EntryRow = Pick<BookRow, "id" | "name" | "color" | "origin" | "summary" | "updated_at">;
type FullRow = EntryRow & Pick<BookRow, "trees" | "move_node">;

/** Whether `id` could be a book id; any other text names a book that doesn't exist. */
const isBookId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const sideOf = (color: string) => (color === "black" ? "black" : "white");

function originOf(value: Json): BookOrigin {
  const parsed = bookOriginSchema.safeParse(value);
  return parsed.success ? parsed.data : { kind: "own" };
}

/**
 * A row's trees. Stored trees were validated when written; a row from before the move has only
 * `move_node`, which is replayed here, and is never refused for its size.
 */
function treesOf(row: Pick<BookRow, "trees" | "move_node">): MoveNode[] {
  if (Array.isArray(row.trees)) return row.trees as unknown as MoveNode[];
  const result = validateTrees(legacyTrees(row.move_node), { verifiedPublisher: true });
  return result.ok ? result.trees : [createRootMoveNode(START_FEN)];
}

function entryOf(row: EntryRow, trees?: MoveNode[]): LibraryEntry {
  const color = sideOf(row.color);
  return {
    id: row.id,
    name: row.name,
    color,
    origin: originOf(row.origin),
    summary: (row.summary as unknown as BookSummary | null) ?? summarize(trees ?? [], color),
    updatedAt: row.updated_at ?? "",
  };
}

function bookOf(row: FullRow): LibraryBook {
  const trees = treesOf(row);
  return { ...entryOf(row, trees), trees };
}

/** Validates trees for a write, or throws why they can't be stored. */
function checkedTrees(input: unknown): MoveNode[] {
  const result = validateTrees(input);
  if (result.ok) return result.trees;
  if (result.reason === "over_limit") {
    throw new LibraryError("over_limit", `This book has ${result.count} positions; the limit is ${result.limit}.`);
  }
  throw new LibraryError("invalid", result.detail);
}

function failed(error: unknown): never {
  console.error("A book query failed.", error);
  throw new LibraryError("failed");
}

/** The user's books, newest change first, without their trees. */
export async function listBooks(userId: string): Promise<LibraryEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_books")
    .select(ENTRY_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(MAX_LIBRARY_BOOKS);
  if (error) failed(error);

  // Books from before the move have no summary yet: read their trees, a capped batch by id.
  const missing = data.filter((row) => row.summary === null).map((row) => row.id);
  const trees = new Map<string, MoveNode[]>();
  if (missing.length) {
    const { data: rows, error: treesError } = await supabase
      .from("opening_books")
      .select("id, trees, move_node")
      .eq("user_id", userId)
      .in("id", missing);
    if (treesError) failed(treesError);
    for (const row of rows) trees.set(row.id, treesOf(row));
  }
  return data.map((row) => entryOf(row, trees.get(row.id)));
}

/**
 * The user's books with their trees, for the server pages that still hand whole books to the
 * client. They read through `useLibrary` from Phase 5's step 7, and this goes.
 */
export async function listBooksWithTrees(userId: string): Promise<LibraryBook[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_books")
    .select(BOOK_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(MAX_LIBRARY_BOOKS);
  if (error) failed(error);
  return data.map(bookOf);
}

export async function getBook(userId: string, bookId: string): Promise<LibraryBook | null> {
  if (!isBookId(bookId)) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_books")
    .select(BOOK_COLUMNS)
    .eq("user_id", userId)
    .eq("id", bookId)
    .maybeSingle();
  if (error) failed(error);
  return data ? bookOf(data) : null;
}

export type BookInput = { name: string; color: "white" | "black"; origin: BookOrigin; trees: unknown };

/** Saves a new book, refused with `full` when the library holds `MAX_LIBRARY_BOOKS`. */
export async function createBook(userId: string, input: BookInput): Promise<LibraryEntry> {
  const trees = checkedTrees(input.trees);
  const supabase = await createServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from("opening_books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) failed(countError);
  if ((count ?? 0) >= MAX_LIBRARY_BOOKS) {
    throw new LibraryError("full", `A library holds at most ${MAX_LIBRARY_BOOKS} books.`);
  }

  const { data, error } = await supabase
    .from("opening_books")
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color,
      origin: input.origin as unknown as Json,
      trees: trees as unknown as Json,
      summary: summarize(trees, input.color) as unknown as Json,
      move_node: startTree(trees) as unknown as Json,
      is_public: false,
      updated_at: new Date().toISOString(),
    })
    .select(ENTRY_COLUMNS)
    .single();
  if (error) failed(error);
  return entryOf(data);
}

export type BookChanges = { name?: string; color?: "white" | "black"; trees?: unknown };

/**
 * Changes a book, but only if it hasn't changed since the client read it at
 * `expectedUpdatedAt`; otherwise it is refused with `stale`. New trees, or a new side, give a
 * new summary.
 */
export async function updateBook(
  userId: string,
  bookId: string,
  changes: BookChanges,
  expectedUpdatedAt: string,
): Promise<LibraryEntry> {
  if (!isBookId(bookId)) throw new LibraryError("not_found");
  const supabase = await createServerSupabaseClient();
  const { data: current, error: readError } = await supabase
    .from("opening_books")
    .select(BOOK_COLUMNS)
    .eq("user_id", userId)
    .eq("id", bookId)
    .maybeSingle();
  if (readError) failed(readError);
  if (!current) throw new LibraryError("not_found");
  if (!sameInstant(current.updated_at, expectedUpdatedAt)) throw new LibraryError("stale");

  const color = changes.color ?? sideOf(current.color);
  const trees = changes.trees === undefined ? null : checkedTrees(changes.trees);
  const resummarize = trees !== null || color !== sideOf(current.color) || current.summary === null;
  const finalTrees = trees ?? treesOf(current);

  const update = supabase
    .from("opening_books")
    .update({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      color,
      ...(trees ? { trees: trees as unknown as Json, move_node: startTree(trees) as unknown as Json } : {}),
      ...(resummarize ? { summary: summarize(finalTrees, color) as unknown as Json } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", bookId);
  // Only if no other write came between the read and this one. Postgres compares the times.
  const { data, error } = await (current.updated_at
    ? update.eq("updated_at", current.updated_at)
    : update.is("updated_at", null)
  )
    .select(ENTRY_COLUMNS)
    .maybeSingle();
  if (error) failed(error);
  if (!data) throw new LibraryError("stale");
  return entryOf(data);
}

/** Deletes a book; its drills and position stats go with it, and its sessions keep their history. */
export async function deleteBook(userId: string, bookId: string): Promise<void> {
  if (!isBookId(bookId)) throw new LibraryError("not_found");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_books")
    .delete()
    .eq("user_id", userId)
    .eq("id", bookId)
    .select("id");
  if (error) failed(error);
  if (!data.length) throw new LibraryError("not_found");
}
