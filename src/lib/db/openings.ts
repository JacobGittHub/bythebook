// A signed-in user's books in `opening_books` (plans/deployment.md D22–D26): the server side
// of the account library. Every query runs with the user's client, so the table's access
// rules apply, and names the user, since "read public books" also lets anyone read a public
// one. Writes validate and summarize here, so a client can't store a bad tree or misreport its
// summary.

import { createServerSupabaseClient } from "@/lib/supabase";
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
import { checkedTrees } from "@/lib/library/writes";
import type { MoveNode } from "@/types/chess";
import type { Json, Tables } from "@/types/database";

type BookRow = Tables<"opening_books">;

const ENTRY_COLUMNS = "id, name, color, origin, summary, updated_at";
const BOOK_COLUMNS = `${ENTRY_COLUMNS}, trees`;

type EntryRow = Pick<BookRow, "id" | "name" | "color" | "origin" | "summary" | "updated_at">;
type FullRow = EntryRow & Pick<BookRow, "trees">;

/** Whether `id` could be a book id; any other text names a book that doesn't exist. */
const isBookId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const sideOf = (color: string) => (color === "black" ? "black" : "white");

function originOf(value: Json): BookOrigin {
  const parsed = bookOriginSchema.safeParse(value);
  return parsed.success ? parsed.data : { kind: "own" };
}

/** A row's trees and summary, which were validated and worked out when it was written. */
const treesOf = (row: Pick<BookRow, "trees">) => row.trees as unknown as MoveNode[];

function entryOf(row: EntryRow): LibraryEntry {
  return {
    id: row.id,
    name: row.name,
    color: sideOf(row.color),
    origin: originOf(row.origin),
    summary: row.summary as unknown as BookSummary,
    updatedAt: row.updated_at ?? "",
  };
}

const bookOf = (row: FullRow): LibraryBook => ({ ...entryOf(row), trees: treesOf(row) });

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
  return data.map((row) => entryOf(row));
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
  const resummarize = trees !== null || color !== sideOf(current.color);
  const finalTrees = trees ?? treesOf(current);

  const update = supabase
    .from("opening_books")
    .update({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      color,
      ...(trees ? { trees: trees as unknown as Json } : {}),
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
