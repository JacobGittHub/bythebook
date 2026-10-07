"use client";

import { useEffect, useRef, useState } from "react";
import {
  EXAMPLE_BOOKS_PATH,
  exampleBookFromFile,
  parseExampleFile,
  parseExampleIndex,
  type ExampleBook,
  type ExampleBookEntry,
} from "@/lib/books/examples";

/**
 * The example books' list, and each book once it is asked for. They are static files, so
 * loading them costs no function call; a book is fetched the first time it is shown.
 */
export function useExampleBooks(wanted: string | null) {
  const [entries, setEntries] = useState<ExampleBookEntry[] | null>(null);
  const [books, setBooks] = useState<ReadonlyMap<string, ExampleBook>>(new Map());
  const [failed, setFailed] = useState(false);
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetch(`${EXAMPLE_BOOKS_PATH}/index.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const index = parseExampleIndex(body);
        setEntries(index?.books ?? []);
        if (!index) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const entry = entries?.find((candidate) => candidate.id === wanted);
    if (!entry || requested.current.has(entry.id)) return;
    requested.current.add(entry.id);
    fetch(`${EXAMPLE_BOOKS_PATH}/${entry.file}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const file = parseExampleFile(body);
        if (!file) throw new Error("Not an example book.");
        setBooks((old) => new Map(old).set(file.id, exampleBookFromFile(file)));
      })
      .catch(() => {
        requested.current.delete(entry.id);
        setFailed(true);
      });
  }, [entries, wanted]);

  return { entries, books, failed };
}
