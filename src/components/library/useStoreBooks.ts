"use client";

import { useEffect, useState } from "react";
import {
  EXAMPLE_BOOKS_PATH,
  exampleBookFromFile,
  parseExampleFile,
  parseExampleIndex,
  type ExampleBook,
} from "@/lib/books/examples";

/**
 * The Bookstore's books. Until the store has its own tables (plans/bookstore.md Phases 3–4),
 * they are the example books, ByTheBook's store books (plans/deployment.md D24), read from
 * their static files: about 60 KB in all, and no function call.
 */
export type StoreBooksState = { books: ExampleBook[] | null; failed: boolean };

let loading: Promise<ExampleBook[]> | null = null;

async function loadStoreBooks(): Promise<ExampleBook[]> {
  const index = parseExampleIndex(await (await fetch(`${EXAMPLE_BOOKS_PATH}/index.json`)).json());
  if (!index) throw new Error("Not an example book index.");
  const books = await Promise.all(
    index.books.map(async (entry) => {
      const response = await fetch(`${EXAMPLE_BOOKS_PATH}/${entry.file}`);
      const file = parseExampleFile(response.ok ? await response.json() : null);
      return file ? exampleBookFromFile(file) : null;
    }),
  );
  return books
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
