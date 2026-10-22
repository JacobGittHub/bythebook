"use client";

// Every game in the viewer's history, read from its store (`useGameHistory`) and read again when
// the history changes, here or in another tab. An account's store fetches only the chunks its
// browser copy doesn't have.

import { useEffect, useState } from "react";
import { useGameHistory, type GameHistoryState } from "@/hooks/useGameHistory";
import { HistoryError, type StoredGame } from "@/lib/history/types";

export type HistoryGamesState = GameHistoryState & {
  /** Every game, in the order they were imported; null until read. */
  games: StoredGame[] | null;
};

export function useHistoryGames(): HistoryGamesState {
  const state = useGameHistory();
  const { history, summary } = state;
  const version = summary?.version ?? null;
  const [read, setRead] = useState<{ version: number; games: StoredGame[] | null; error: string | null } | null>(null);

  useEffect(() => {
    if (version === null) return;
    let live = true;
    history.chunks().then(
      (chunks) => live && setRead({ version, games: chunks.flatMap((chunk) => chunk.games), error: null }),
      (error: unknown) =>
        live && setRead({ version, games: null, error: error instanceof HistoryError ? error.message : "The games couldn't be read." }),
    );
    return () => {
      live = false;
    };
  }, [history, version]);

  const mine = read && read.version === version ? read : null;
  return { ...state, games: mine?.games ?? null, error: state.error ?? mine?.error ?? null };
}
