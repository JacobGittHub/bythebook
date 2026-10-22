"use client";

// The viewer's game history (plans/game-history.md D14, D15), chosen from `useViewer()` as
// `useLibrary()` chooses the library: this browser's for a guest, the account's for a signed-in
// viewer. A guest's visit deletes any account's copy of its games, as after signing out.

import { useCallback, useEffect, useState } from "react";
import { useViewer } from "@/context/Viewer";
import { ACCOUNT_HISTORY_COPY_DB, accountHistoryFor, forgetAccountHistoryCopy, type AccountHistory } from "@/lib/history/accountHistory";
import { BROWSER_HISTORY_DB, browserHistory, onBrowserHistoryChange } from "@/lib/history/browserHistory";
import { HistoryError, type GameHistoryStore, type HistorySummary } from "@/lib/history/types";

export type GameHistoryState = {
  history: GameHistoryStore;
  /** The history's summary; null until read. */
  summary: HistorySummary | null;
  error: string | null;
  reload: () => void;
};

/** One store per account, so every page shares its copy. */
const accounts = new Map<string, AccountHistory>();

function storeFor(userId: string | null): GameHistoryStore {
  if (!userId) return browserHistory;
  let store = accounts.get(userId);
  if (!store) accounts.set(userId, (store = accountHistoryFor(userId)));
  return store;
}

export function useGameHistory(): GameHistoryState {
  const { signedIn, userId } = useViewer();
  const history = storeFor(signedIn ? userId : null);
  const [read, setRead] = useState<{ history: GameHistoryStore; summary: HistorySummary | null; error: string | null } | null>(null);

  const reload = useCallback(() => {
    history.summary().then(
      (summary) => setRead({ history, summary, error: null }),
      (error: unknown) =>
        setRead({ history, summary: null, error: error instanceof HistoryError ? error.message : "The games couldn't be read." }),
    );
  }, [history]);

  useEffect(() => {
    if (history.store === "browser") void forgetAccountHistoryCopy();
  }, [history]);

  // Another tab's import or deletion shows here too.
  useEffect(() => {
    reload();
    return onBrowserHistoryChange(reload, history.store === "browser" ? BROWSER_HISTORY_DB : ACCOUNT_HISTORY_COPY_DB);
  }, [history, reload]);

  const mine = read && read.history === history ? read : null;
  return { history, summary: mine?.summary ?? null, error: mine?.error ?? null, reload };
}
