"use client";

import { useEffect, useMemo, useState } from "react";
import { forDisplay } from "@/lib/chess/explorerData";
import type { ExplorerResponse } from "@/types/chess";

export type OpeningExplorerResult = {
  data: ExplorerResponse | null;
  loading: boolean;
  error: string | null;
};

/** The answer for one position. Until the answer for the current one arrives, it's loading. */
type Answer = { fen: string; data: ExplorerResponse | null; error: string | null };

export function useOpeningExplorer(fen: string): OpeningExplorerResult {
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!fen) return;

    let cancelled = false;

    fetch("/api/openings/explorer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<ExplorerResponse>;
      })
      .then((data) => {
        if (!cancelled) setAnswer({ fen, data: forDisplay(data), error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAnswer({ fen, data: null, error: err instanceof Error ? err.message : "unknown" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fen]);

  return useMemo(() => {
    if (!fen) return { data: null, loading: false, error: null };
    if (answer?.fen !== fen) return { data: null, loading: true, error: null };
    return { data: answer.data, loading: false, error: answer.error };
  }, [fen, answer]);
}
