import type { ExplorerMove } from "@/types/chess";

export async function fetchExplorerMoves(fen: string): Promise<ExplorerMove[]> {
  return [
    { san: fen ? "e4" : "d4", uci: "e2e4", white: 48, draws: 28, black: 24 },
    { san: "Nf3", uci: "g1f3", white: 45, draws: 30, black: 25 },
  ];
}
