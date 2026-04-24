"use client";

import { useEffect, useState } from "react";
import type { ExplorerResponse } from "@/types/chess";

/**
 * Fetches Lichess explorer data for multiple FEN positions in parallel.
 * Responses are keyed by FEN string. Uses the same proxied route as
 * useOpeningExplorer so position_cache is shared.
 */
export function useOpeningExplorerMulti(
  fens: string[],
): Record<string, ExplorerResponse | null> {
  const [results, setResults] = useState<Record<string, ExplorerResponse | null>>({});

  // Stable string key so the effect only re-runs when FEN content actually changes.
  const fensKey = fens.join("||");

  useEffect(() => {
    if (fens.length === 0) {
      setResults({});
      return;
    }

    let cancelled = false;

    Promise.all(
      fens.map(async (fen): Promise<[string, ExplorerResponse | null]> => {
        try {
          const res = await fetch("/api/openings/explorer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fen }),
          });
          if (!res.ok) return [fen, null];
          const data = (await res.json()) as ExplorerResponse;
          return [fen, data];
        } catch {
          return [fen, null];
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setResults(Object.fromEntries(pairs));
    });

    return () => {
      cancelled = true;
    };
  }, [fensKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return results;
}
