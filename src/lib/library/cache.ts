// One library as the pages share it (deployment.md D1, D12): the book list is read once and
// kept current by the writes made through it, and a book's trees are kept once opened, until
// the list shows the book changed. Pages moving between the Explorer, the Library and the
// views then read nothing twice. `src/context/Library.tsx` gives each page the current one.

import { byNewest, entryOf } from "./writes";
import { LibraryError, type Library, type LibraryBook, type LibraryEntry } from "./types";

/** The shared list: null until it has been read. */
export type LibraryListState = { books: LibraryEntry[] | null; error: LibraryError | null };

export type CachedLibrary = Library & {
  /** The list as last read or written. The same object until it changes. */
  state(): LibraryListState;
  subscribe(listener: () => void): () => void;
  /** Reads the list unless it has been read, or is being read. */
  load(): void;
  /** Reads the list again, as after another tab changed the library. */
  reload(): Promise<void>;
};

const failure = (error: unknown) =>
  error instanceof LibraryError ? error : new LibraryError("failed", "The library couldn't be read.");

export function cachedLibrary(base: Library): CachedLibrary {
  let state: LibraryListState = { books: null, error: null };
  const listeners = new Set<() => void>();
  /** Opened books by id. One is served only while the list holds the same `updatedAt`. */
  const opened = new Map<string, LibraryBook>();
  let reading: Promise<void> | null = null;
  let generation = 0;

  function set(next: Partial<LibraryListState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  /** Puts an entry in the list, or takes one out, if the list has been read. */
  function place(id: string, entry: LibraryEntry | null) {
    if (!state.books) return;
    const rest = state.books.filter((book) => book.id !== id);
    set({ books: entry ? [...rest, entry].sort(byNewest) : rest });
  }

  function read(): Promise<void> {
    const mine = ++generation;
    reading = base.list().then(
      (books) => {
        if (mine === generation) set({ books, error: null });
      },
      (error: unknown) => {
        if (mine === generation) set({ error: failure(error) });
      },
    );
    return reading;
  }

  return {
    store: base.store,

    state: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load() {
      if (!reading) void read();
    },

    reload: read,

    async list() {
      await read();
      if (state.error) throw state.error;
      return state.books ?? [];
    },

    async get(id) {
      const known = opened.get(id);
      const listed = state.books?.find((book) => book.id === id);
      if (known && listed && listed.updatedAt === known.updatedAt) return known;
      const book = await base.get(id);
      if (book) {
        opened.set(id, book);
        if (listed?.updatedAt !== book.updatedAt) place(id, entryOf(book));
      } else {
        opened.delete(id);
        place(id, null);
      }
      return book;
    },

    async create(draft) {
      const entry = await base.create(draft);
      place(entry.id, entry);
      return entry;
    },

    async update(id, patch, expectedUpdatedAt) {
      let entry: LibraryEntry;
      try {
        entry = await base.update(id, patch, expectedUpdatedAt);
      } catch (error) {
        if (error instanceof LibraryError && (error.code === "stale" || error.code === "not_found")) {
          opened.delete(id);
          if (error.code === "not_found") place(id, null);
        }
        throw error;
      }
      // New trees are read back when next opened, as the store may have merged or reordered
      // them; a new name or side keeps the opened trees.
      const known = opened.get(id);
      if (known && patch.trees === undefined) opened.set(id, { ...entry, trees: known.trees });
      else opened.delete(id);
      place(id, entry);
      return entry;
    },

    async remove(id) {
      try {
        await base.remove(id);
      } catch (error) {
        if (!(error instanceof LibraryError && error.code === "not_found")) throw error;
        // Already gone: the list catches up, and the page hears why.
        opened.delete(id);
        place(id, null);
        throw error;
      }
      opened.delete(id);
      place(id, null);
    },
  };
}
