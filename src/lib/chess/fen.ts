import { Chess } from "chess.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function normalizeFen(fen: string) {
  const normalized = fen.trim();

  if (!normalized || normalized === "startpos") {
    return START_FEN;
  }

  return normalized;
}

export function toPositionKey(fen: string) {
  const normalizedFen = normalizeFen(fen);
  const [board, turn = "w", castling = "-", enPassant = "-"] =
    normalizedFen.split(" ");

  return [board, turn, castling, enPassant].join(" ");
}

/** The position after playing `uci` from `fen`, or null if the FEN is invalid or the move illegal. */
export function fenAfterUci(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return chess.fen();
  } catch {
    return null;
  }
}
