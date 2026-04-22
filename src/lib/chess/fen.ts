export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function normalizeFen(fen: string) {
  const normalized = fen.trim();

  if (!normalized || normalized === "startpos") {
    return START_FEN;
  }

  return normalized;
}
