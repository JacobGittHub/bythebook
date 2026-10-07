// The account library: a signed-in user's books, through `/api/openings/books`
// (plans/deployment.md D22). The server validates and summarizes, so this only carries
// requests and reports a refusal as a `LibraryError` with the server's code.

import type { MoveNode } from "@/types/chess";
import { libraryErrorFrom } from "./http";
import { withStartTree } from "./trees";
import { LibraryError, type BookDraft, type BookPatch, type Library, type LibraryBook, type LibraryEntry } from "./types";

const BOOKS_URL = "/api/openings/books";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json" } } : init);
  } catch {
    throw new LibraryError("failed", "The server couldn't be reached.");
  }
  if (!response.ok) throw await libraryErrorFrom(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const bookUrl = (id: string) => `${BOOKS_URL}/${encodeURIComponent(id)}`;

export const accountLibrary: Library = {
  store: "account",

  async list() {
    return (await request<{ books: LibraryEntry[] }>(BOOKS_URL)).books;
  },

  async get(id) {
    try {
      return await request<LibraryBook>(bookUrl(id));
    } catch (error) {
      if (error instanceof LibraryError && error.code === "not_found") return null;
      throw error;
    }
  },

  create(draft: BookDraft) {
    return request<LibraryEntry>(BOOKS_URL, { method: "POST", body: JSON.stringify(draft) });
  },

  update(id: string, patch: BookPatch, expectedUpdatedAt: string) {
    return request<LibraryEntry>(bookUrl(id), {
      method: "PATCH",
      body: JSON.stringify({ ...patch, expectedUpdatedAt }),
    });
  },

  remove(id) {
    return request<void>(bookUrl(id), { method: "DELETE" });
  },
};

/** What a page tells the user when its copy of a book was out of date. */
export const STALE_BOOK_MESSAGE = "This book changed in another tab or device, so it was reloaded. Please make your change again.";

/**
 * Saves `tree` as the book's tree from the starting position, for the pages that edit one tree.
 * If the book changed elsewhere since it was read, nothing is saved and the current book comes
 * back with `saved: false`, so the page can show it rather than keep a copy that can't save.
 */
export async function saveStartTree(book: LibraryBook, tree: MoveNode): Promise<{ book: LibraryBook; saved: boolean }> {
  const trees = withStartTree(book.trees, tree);
  try {
    const entry = await accountLibrary.update(book.id, { trees }, book.updatedAt);
    return { book: { ...entry, trees }, saved: true };
  } catch (error) {
    if (!(error instanceof LibraryError && error.code === "stale")) throw error;
    const current = await accountLibrary.get(book.id);
    if (!current) throw new LibraryError("not_found");
    return { book: current, saved: false };
  }
}
