// Explorer-data helpers shared by the server route and client code. Pure, no I/O.
import type { ExplorerMove, ExplorerResponse, ExplorerTotals } from "@/types/chess";

/** How many moves are requested from Lichess per position. Lichess honours 20 (checked 2026-09-29). */
export const EXPLORER_MOVES_LIMIT = 20;

/** How many moves the Explorer page, mini tree and dashboard tree show. */
export const EXPLORER_DISPLAY_MOVES = 12;

// Lichess returns castling as king-to-rook (e1h1, e1a1, e8h8, e8a8).
// chess.js expects king-to-destination (e1g1, e1c1, e8g8, e8c8).
const CASTLING_UCI: Record<string, string> = {
  e1h1: "e1g1",
  e1a1: "e1c1",
  e8h8: "e8g8",
  e8a8: "e8c8",
};

export function normalizeCastling(data: ExplorerResponse): ExplorerResponse {
  return {
    ...data,
    moves: data.moves.map((m) => ({
      ...m,
      uci: CASTLING_UCI[m.uci] ?? m.uci,
    })),
  };
}

export function gameCount(stats: ExplorerMove | ExplorerTotals) {
  return stats.white + stats.draws + stats.black;
}

/** False for cache rows written before totals were kept or the move limit was raised. */
export function isCacheEntryCurrent(data: ExplorerResponse) {
  return data.totals !== undefined && (data.movesLimit ?? 0) >= EXPLORER_MOVES_LIMIT;
}

/** Trims explorer data to the moves the existing UI shows, so its lists and totals don't change. */
export function forDisplay(data: ExplorerResponse): ExplorerResponse {
  return { ...data, moves: data.moves.slice(0, EXPLORER_DISPLAY_MOVES) };
}
