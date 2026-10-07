// The browser library: a guest's books, kept in this browser's IndexedDB (plans/deployment.md
// D12, D23). It belongs to one browser profile and one site address. Writes follow the same
// rules as the account's (`writes.ts`), so a book that leaves the browser later (D22) is one
// the server accepts.
//
// Three stores: `books` holds each book without its trees, so the list reads little;
// `trees` holds the trees by book id; `meta` holds when the library was last backed up and
// whether it changed since. A write tells this browser's other tabs (`onBrowserLibraryChange`).

import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import type { MoveNode } from "@/types/chess";
import { byNewest, checkedDraft, checkedPatch, entryOf, newBook, patchedBook } from "./writes";
import { LibraryError, MAX_LIBRARY_BOOKS, type Library, type LibraryEntry } from "./types";

/** The IndexedDB database's name, and the channel its tabs talk on. */
export const BROWSER_LIBRARY_DB = "bythebook-library";
const DB_VERSION = 1;

/** When the library was last backed up, and whether a book changed since (D23). */
export type BackupState = { lastBackupAt: string | null; changedSinceBackup: boolean };

const NO_BACKUP: BackupState = { lastBackupAt: null, changedSinceBackup: false };

interface LibrarySchema extends DBSchema {
  books: { key: string; value: LibraryEntry };
  trees: { key: string; value: { id: string; trees: MoveNode[] } };
  meta: { key: "backup"; value: BackupState };
}

type LibraryDatabase = IDBPDatabase<LibrarySchema>;
type WriteTransaction = IDBPTransaction<LibrarySchema, ("books" | "trees" | "meta")[], "readwrite">;

export type BrowserLibrary = Library & {
  readonly store: "browser";
  backupState(): Promise<BackupState>;
  /** Notes a backup made at `at`, which holds every book as of then. */
  recordBackup(at: Date): Promise<void>;
};

/** Any failure that isn't the library's own, as one the page can show. */
function asLibraryError(error: unknown): LibraryError {
  if (error instanceof LibraryError) return error;
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new LibraryError("failed", "This browser has no room left to keep books.");
  }
  console.error("The browser library failed.", error);
  return new LibraryError("failed", "This browser couldn't keep books. A private window may not allow it.");
}

/** A browser library kept in the IndexedDB database `name`; tests give each a name of its own. */
export function browserLibraryNamed(name: string): BrowserLibrary {
  let opening: Promise<LibraryDatabase> | null = null;

  function database(): Promise<LibraryDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new LibraryError("failed", "This browser can't keep books."));
    }
    opening ??= openDB<LibrarySchema>(name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("books", { keyPath: "id" });
        db.createObjectStore("trees", { keyPath: "id" });
        db.createObjectStore("meta");
      },
      // A newer version of the app opened the database in another tab: let it upgrade, and
      // open again on the next call.
      blocking() {
        void opening?.then((db) => db.close());
        opening = null;
      },
      terminated() {
        opening = null;
      },
    }).catch((error: unknown) => {
      opening = null;
      throw error;
    });
    return opening;
  }

  async function run<T>(work: (db: LibraryDatabase) => Promise<T>): Promise<T> {
    try {
      return await work(await database());
    } catch (error) {
      throw asLibraryError(error);
    }
  }

  /** Marks the library changed since its last backup, in the write's own transaction. */
  async function markChanged(tx: WriteTransaction) {
    const meta = tx.objectStore("meta");
    const state = (await meta.get("backup")) ?? NO_BACKUP;
    if (!state.changedSinceBackup) await meta.put({ ...state, changedSinceBackup: true }, "backup");
  }

  const changed = () => announceChange(name);

  return {
    store: "browser",

    list() {
      return run(async (db) => (await db.getAll("books")).sort(byNewest));
    },

    get(id) {
      return run(async (db) => {
        const tx = db.transaction(["books", "trees"]);
        const [entry, trees] = await Promise.all([tx.objectStore("books").get(id), tx.objectStore("trees").get(id)]);
        await tx.done;
        return entry && trees ? { ...entry, trees: trees.trees } : null;
      });
    },

    async create(draft) {
      // Checked before the transaction opens: replaying moves takes time, and a transaction
      // closes when it has nothing to do. A refusal inside one has written nothing, so it
      // simply ends.
      const book = newBook(checkedDraft(draft), crypto.randomUUID(), new Date());
      const entry = await run(async (db) => {
        const tx = db.transaction(["books", "trees", "meta"], "readwrite");
        const books = tx.objectStore("books");
        if ((await books.count()) >= MAX_LIBRARY_BOOKS) {
          throw new LibraryError("full", `A library holds at most ${MAX_LIBRARY_BOOKS} books.`);
        }
        const entry = entryOf(book);
        await books.add(entry);
        await tx.objectStore("trees").add({ id: book.id, trees: book.trees });
        await markChanged(tx);
        await tx.done;
        return entry;
      });
      changed();
      return entry;
    },

    async update(id, patch, expectedUpdatedAt) {
      const checked = checkedPatch(patch);
      const entry = await run(async (db) => {
        const tx = db.transaction(["books", "trees", "meta"], "readwrite");
        const [current, trees] = await Promise.all([tx.objectStore("books").get(id), tx.objectStore("trees").get(id)]);
        if (!current || !trees) {
          throw new LibraryError("not_found");
        }
        const book = patchedBook({ ...current, trees: trees.trees }, checked, expectedUpdatedAt, new Date());
        const entry = entryOf(book);
        await tx.objectStore("books").put(entry);
        if (checked.trees) await tx.objectStore("trees").put({ id, trees: book.trees });
        await markChanged(tx);
        await tx.done;
        return entry;
      });
      changed();
      return entry;
    },

    async remove(id) {
      await run(async (db) => {
        const tx = db.transaction(["books", "trees", "meta"], "readwrite");
        if (!(await tx.objectStore("books").getKey(id))) {
          throw new LibraryError("not_found");
        }
        await tx.objectStore("books").delete(id);
        await tx.objectStore("trees").delete(id);
        await markChanged(tx);
        await tx.done;
      });
      changed();
    },

    backupState() {
      return run(async (db) => (await db.get("meta", "backup")) ?? NO_BACKUP);
    },

    recordBackup(at) {
      return run(async (db) => {
        await db.put("meta", { lastBackupAt: at.toISOString(), changedSinceBackup: false }, "backup");
      });
    },
  };
}

/** This browser's library. */
export const browserLibrary = browserLibraryNamed(BROWSER_LIBRARY_DB);

function announceChange(name: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(name);
  channel.postMessage("changed");
  channel.close();
}

/**
 * Calls `listener` when another tab of this browser changes its library, and returns the
 * function that stops it. A tab isn't told of its own changes.
 */
export function onBrowserLibraryChange(listener: () => void, name: string = BROWSER_LIBRARY_DB): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(name);
  channel.onmessage = () => listener();
  return () => channel.close();
}
