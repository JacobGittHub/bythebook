"use client";

// The viewer's game history (plans/game-history.md D14, D15), chosen from `useViewer()` as
// `useLibrary()` chooses the library: this browser's for a guest. An account's store comes with
// the history routes (Phase 3); until then a signed-in viewer has none, so `history` is null.

import { useCallback, useEffect, useState } from "react";
import { useViewer } from "@/context/Viewer";
import { browserHistory, onBrowserHistoryChange } from "@/lib/history/browserHistory";
import { HistoryError, type GameHistoryStore, type HistorySummary } from "@/lib/history/types";

export type GameHistoryState = {
  history: GameHistoryStore | null;
  /** The history's summary; null until read, or when there is no store. */
  summary: HistorySummary | null;
  error: string | null;
  reload: () => void;
};

export function useGameHistory(): GameHistoryState {
  const { signedIn } = useViewer();
  const history = signedIn ? null : browserHistory;
  const [read, setRead] = useState<{ history: GameHistoryStore; summary: HistorySummary | null; error: string | null } | null>(null);

  const reload = useCallback(() => {
    if (!history) return;
    history.summary().then(
      (summary) => setRead({ history, summary, error: null }),
      (error: unknown) =>
        setRead({ history, summary: null, error: error instanceof HistoryError ? error.message : "The games couldn't be read." }),
    );
  }, [history]);

  // Another tab's import or deletion shows here too.
  useEffect(() => {
    if (!history) return;
    reload();
    return onBrowserHistoryChange(reload);
  }, [history, reload]);

  const mine = read && read.history === history ? read : null;
  return { history, summary: mine?.summary ?? null, error: mine?.error ?? null, reload };
}
