// A signed-in account's game history (plans/game-history.md D15, D26), through `/api/history`.
// The server checks every write, so this only carries requests. A write sends its chunks one
// request each (staged), then commits them, since one import can be larger than a request may be.
//
// The browser keeps a copy of the chunks in IndexedDB, with the version that wrote each, so a page
// reads the small summary and fetches only the chunks that changed. The copy belongs to one
// account: another account's, or a guest's visit (as after signing out), deletes it
// (`forgetAccountHistoryCopy`). It is only a copy, so when IndexedDB fails the chunks are fetched.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { announceHistoryChange } from "./browserHistory";
import { historyErrorFrom } from "./http";
import { HistoryError, type GameHistoryStore, type HistorySummary, type RoomRequest, type StoredChunk } from "./types";

const HISTORY_URL = "/api/history";
/** The IndexedDB database of the account's copy, and the channel its tabs talk on. */
export const ACCOUNT_HISTORY_COPY_DB = "bythebook-history-account";
const DB_VERSION = 1;
/** Chunks fetched or sent at once. */
const PARALLEL_REQUESTS = 3;

interface CopySchema extends DBSchema {
  chunks: { key: number; value: { chunk: StoredChunk; version: number } };
  meta: { key: "owner"; value: string };
}

type CopyDatabase = IDBPDatabase<CopySchema>;

export type AccountHistory = GameHistoryStore & { readonly store: "account"; requestRoom: NonNullable<GameHistoryStore["requestRoom"]> };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json" } } : init);
  } catch {
    throw new HistoryError("failed", "The server couldn't be reached.");
  }
  if (!response.ok) throw await historyErrorFrom(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Runs `work` on each item, `PARALLEL_REQUESTS` at a time, and returns the results in order. */
async function inTurn<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, items.length) }, worker));
  return results;
}

/** The account `userId`'s history, its copy kept in the IndexedDB database `copyName`. */
export function accountHistoryFor(userId: string, copyName = ACCOUNT_HISTORY_COPY_DB): AccountHistory {
  let opening: Promise<CopyDatabase | null> | null = null;

  /** The copy, emptied first if another account kept it; null when this browser can't keep one. */
  function copy(): Promise<CopyDatabase | null> {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    opening ??= (async () => {
      const db = await openDB<CopySchema>(copyName, DB_VERSION, {
        upgrade(db) {
          db.createObjectStore("chunks");
          db.createObjectStore("meta");
        },
        blocking() {
          void opening?.then((db) => db?.close());
          opening = null;
        },
        terminated() {
          opening = null;
        },
      });
      if ((await db.get("meta", "owner")) !== userId) {
        const tx = db.transaction(["chunks", "meta"], "readwrite");
        await Promise.all([tx.objectStore("chunks").clear(), tx.objectStore("meta").put(userId, "owner")]);
        await tx.done;
      }
      return db;
    })().catch((error: unknown) => {
      console.error("The account's copy of its games couldn't be opened.", error);
      return null;
    });
    return opening;
  }

  /** Changes the copy, which is only a convenience: a failure leaves it to be fetched again. */
  async function changeCopy(work: (db: CopyDatabase) => Promise<void>) {
    try {
      const db = await copy();
      if (db) await work(db);
    } catch (error) {
      console.error("The account's copy of its games couldn't be changed.", error);
    }
  }

  async function copied(n: number, version: number): Promise<StoredChunk | null> {
    try {
      const kept = await (await copy())?.get("chunks", n);
      return kept?.version === version ? kept.chunk : null;
    } catch {
      return null;
    }
  }

  const summary = () => request<HistorySummary>(HISTORY_URL);
  const changed = () => announceHistoryChange(copyName);

  return {
    store: "account",

    summary,

    async chunks() {
      const { chunks } = await summary();
      const result = await inTurn(chunks, async ({ n, version }) => {
        const kept = await copied(n, version);
        if (kept) return kept;
        const chunk = await request<StoredChunk>(`${HISTORY_URL}/chunks/${n}`);
        await changeCopy((db) => db.put("chunks", { chunk, version }, n).then(() => {}));
        return chunk;
      });
      // Chunks the account no longer has leave the copy.
      const live = new Set(chunks.map((chunk) => chunk.n));
      await changeCopy(async (db) => {
        const stale = (await db.getAllKeys("chunks")).filter((n) => !live.has(n));
        await Promise.all(stale.map((n) => db.delete("chunks", n)));
      });
      return result;
    },

    async write(change, expectedVersion) {
      await inTurn(change.chunks, (chunk) =>
        request<void>(`${HISTORY_URL}/chunks/${chunk.n}`, { method: "PUT", body: JSON.stringify({ expectedVersion, games: chunk.games }) }),
      );
      const next = await request<HistorySummary>(HISTORY_URL, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion,
          written: change.chunks.map((chunk) => chunk.n),
          deleted: change.deleted,
          username: change.username,
          imports: change.imports,
        }),
      });
      await changeCopy(async (db) => {
        const tx = db.transaction("chunks", "readwrite");
        await Promise.all([
          ...change.deleted.map((n) => tx.store.delete(n)),
          ...change.chunks.map((chunk) => tx.store.put({ chunk, version: next.version }, chunk.n)),
        ]);
        await tx.done;
      });
      changed();
      return next;
    },

    async clear() {
      await request<void>(HISTORY_URL, { method: "DELETE" });
      await changeCopy((db) => db.clear("chunks"));
      changed();
    },

    async requestRoom(room) {
      const made = await request<RoomRequest>(`${HISTORY_URL}/requests`, { method: "POST", body: JSON.stringify(room) });
      changed();
      return made;
    },
  };
}

/** Deletes the account's copy of its games, as when a guest opens the dashboard after signing out. */
export async function forgetAccountHistoryCopy(copyName = ACCOUNT_HISTORY_COPY_DB): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const deleting = indexedDB.deleteDatabase(copyName);
    deleting.onsuccess = deleting.onerror = deleting.onblocked = () => resolve();
  });
}
