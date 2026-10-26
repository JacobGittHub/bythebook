"use client";

import { useEffect, useState } from "react";
import {
  EXAMPLE_BOOKS_PATH,
  PLAYER_BOOKS_PATH,
  exampleBookFromFile,
  parseExampleFile,
  parseExampleIndex,
  type ExampleBook,
} from "@/lib/books/examples";

/**
 * The Bookstore's books. Until the store has its own tables (plans/bookstore.md Phases 3–4),
 * they are the example books and the player books published from the publishing account's
 * drafts, ByTheBook's store books (plans/deployment.md D24), read from their static files: a
 * few hundred KB in all, and no function call.
 */
export type StoreBooksState = { books: ExampleBook[] | null; failed: boolean };

let loading: Promise<ExampleBook[]> | null = null;

/** One folder's books. The example books must load; the player books' folder may be empty. */
async function loadFolder(folder: string, required: boolean): Promise<(ExampleBook | null)[]> {
  const response = await fetch(`${folder}/index.json`);
  const index = parseExampleIndex(response.ok ? await response.json() : null);
  if (!index) {
    if (required) throw new Error("Not an example book index.");
    return [];
  }
  return Promise.all(
    index.books.map(async (entry) => {
      const response = await fetch(`${folder}/${entry.file}`);
      const file = parseExampleFile(response.ok ? await response.json() : null);
      return file ? exampleBookFromFile(file) : null;
    }),
  );
}

async function loadStoreBooks(): Promise<ExampleBook[]> {
  const [examples, players] = await Promise.all([loadFolder(EXAMPLE_BOOKS_PATH, true), loadFolder(PLAYER_BOOKS_PATH, false)]);
  return [...examples, ...players]
    .filter((book): book is ExampleBook => book !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Every store book, read once per page load and shared by every page that asks. */
export function useStoreBooks(): StoreBooksState {
  const [state, setState] = useState<StoreBooksState>({ books: null, failed: false });
  useEffect(() => {
    let current = true;
    loading ??= loadStoreBooks();
    loading.then(
      (books) => {
        if (current) setState({ books, failed: false });
      },
      () => {
        // A failed read can be tried again on the next visit.
        loading = null;
        if (current) setState({ books: null, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, []);
  return state;
}
