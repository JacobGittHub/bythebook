"use client";

import type { ExplorerMove } from "@/types/chess";

export function useOpeningExplorer(fen: string) {
  if (!fen) {
    return [];
  }

  const moves: ExplorerMove[] = [
    { san: "e4", uci: "e2e4", white: 48, draws: 28, black: 24 },
    { san: "d4", uci: "d2d4", white: 46, draws: 31, black: 23 },
  ];

  return moves;
}
