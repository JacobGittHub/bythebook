// A guest's game history, kept in this browser's IndexedDB (plans/game-history.md D14, D25). It
// follows the same write rules as an account's (`writes.ts`), and a write checks the version it
// was planned from, so two tabs importing at once can't interleave. A write tells this browser's
// other tabs (`onBrowserHistoryChange`) and asks the browser to keep the data, as the guest
// library does (`src/lib/library/browserStore.ts`).
//
// Two stores: `chunks` holds the games by chunk number, and `meta` the summary, so a page can
// read how many games there are without reading them.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { askToKeepData } from "@/lib/library/browserStore";
import { checkedWrite, emptySummary } from "./writes";
import {
  DEFAULT_GAME_HISTORY_LIMIT,
  HistoryError,
  type GameHistoryStore,
  type HistorySummary,
  type StoredChunk,
} from "./types";

/** The IndexedDB database's name, and the channel its tabs talk on. */
export const BROWSER_HISTORY_DB = "bythebook-history";
const DB_VERSION = 1;

/** The summary as kept; the limit is the guest's, from the constant, so raising it needs no write. */
type KeptSummary = Omit<HistorySummary, "limit">;

interface HistorySchema extends DBSchema {
  chunks: { key: number; value: StoredChunk };
  meta: { key: "summary"; value: KeptSummary };
}

type HistoryDatabase = IDBPDatabase<HistorySchema>;

export type BrowserHistory = GameHistoryStore & { readonly store: "browser" };

/** Any failure that isn't the history's own, as one the page can show. */
function asHistoryError(error: unknown): HistoryError {
  if (error instanceof HistoryError) return error;
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new HistoryError("failed", "This browser has no room left to keep games.");
  }
  console.error("The browser's game history failed.", error);
  return new HistoryError("failed", "This browser couldn't keep games. A private window may not allow it.");
}

/** A browser history kept in the IndexedDB database `name`; tests give each a name of its own. */
export function browserHistoryNamed(name: string, limit = DEFAULT_GAME_HISTORY_LIMIT): BrowserHistory {
  let opening: Promise<HistoryDatabase> | null = null;

  function database(): Promise<HistoryDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new HistoryError("failed", "This browser can't keep games."));
    }
    opening ??= openDB<HistorySchema>(name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("chunks", { keyPath: "n" });
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

  async function run<T>(work: (db: HistoryDatabase) => Promise<T>): Promise<T> {
    try {
      return await work(await database());
    } catch (error) {
      throw asHistoryError(error);
    }
  }

  const withLimit = (kept: KeptSummary | undefined): HistorySummary => (kept ? { ...kept, limit } : emptySummary(limit));
  const toKept = ({ games, chunks, username, lastImportAt, version }: HistorySummary): KeptSummary => ({
    games,
    chunks,
    username,
    lastImportAt,
    version,
  });
  const changed = () => announceChange(name);

  return {
    store: "browser",

    summary() {
      return run(async (db) => withLimit(await db.get("meta", "summary")));
    },

    chunks() {
      // IndexedDB returns them in key order, which is chunk order.
      return run((db) => db.getAll("chunks"));
    },

    async write(change, expectedVersion) {
      const summary = await run(async (db) => {
        // The rules are checked against the summary in the same transaction, so another tab's
        // write in between is caught by the version.
        const tx = db.transaction(["chunks", "meta"], "readwrite");
        const current = withLimit(await tx.objectStore("meta").get("summary"));
        if (current.version !== expectedVersion) {
          throw new HistoryError("stale", "The games changed in another tab. Import the file again.");
        }
        const checked = checkedWrite(current, change, new Date());
        const chunks = tx.objectStore("chunks");
        await Promise.all([
          ...checked.change.deleted.map((n) => chunks.delete(n)),
          ...checked.change.chunks.map((chunk) => chunks.put(chunk)),
        ]);
        await tx.objectStore("meta").put(toKept(checked.summary), "summary");
        await tx.done;
        return checked.summary;
      });
      changed();
      askToKeepData();
      return summary;
    },

    async clear() {
      await run(async (db) => {
        const tx = db.transaction(["chunks", "meta"], "readwrite");
        const current = withLimit(await tx.objectStore("meta").get("summary"));
        // The version keeps counting, so a write planned before the deletion is refused.
        const empty = { ...emptySummary(limit), version: current.version + 1 };
        await Promise.all([tx.objectStore("chunks").clear(), tx.objectStore("meta").put(toKept(empty), "summary")]);
        await tx.done;
      });
      changed();
    },
  };
}

/** This browser's game history. */
export const browserHistory = browserHistoryNamed(BROWSER_HISTORY_DB);

function announceChange(name: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(name);
  channel.postMessage("changed");
  channel.close();
}

/**
 * Calls `listener` when a tab of this browser changes its game history, and returns the function
 * that stops it. The tab that made the change is told too, as with the library.
 */
export function onBrowserHistoryChange(listener: () => void, name: string = BROWSER_HISTORY_DB): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(name);
  channel.onmessage = () => listener();
  return () => channel.close();
}
