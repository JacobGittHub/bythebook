"use client";

import { useEffect, useState } from "react";
import type { ExplorerResponse } from "@/types/chess";

export type OpeningExplorerResult = {
  data: ExplorerResponse | null;
  loading: boolean;
  error: string | null;
};

export function useOpeningExplorer(fen: string): OpeningExplorerResult {
  const [state, setState] = useState<OpeningExplorerResult>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!fen) return;

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

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
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fen]);

  return state;
}
