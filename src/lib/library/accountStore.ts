// The account library: a signed-in user's books, through `/api/openings/books`
// (plans/deployment.md D22). The server validates and summarizes, so this only carries
// requests and reports a refusal as a `LibraryError` with the server's code.

import { libraryErrorFrom } from "./http";
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

