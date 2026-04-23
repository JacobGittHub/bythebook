import { Chess } from "chess.js";

export type ParsedInfoLine = {
  multipv: number;
  depth: number;
  score: number | null;  // centipawns, white-positive
  mate: number | null;   // moves to mate (positive = white wins, negative = black wins)
  pv: string[];          // UCI moves
};

/** Parse a UCI `info` line. Returns null for lines that don't carry evaluation. */
export function parseInfoLine(line: string): ParsedInfoLine | null {
  if (!line.startsWith("info") || !line.includes("score")) return null;

  const depth = parseInt(line.match(/\bdepth (\d+)/)?.[1] ?? "0");
  if (!depth) return null;

  const multipv = parseInt(line.match(/\bmultipv (\d+)/)?.[1] ?? "1");

  let score: number | null = null;
  let mate: number | null = null;

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  const mateMatch = line.match(/\bscore mate (-?\d+)/);

  if (mateMatch) {
    mate = parseInt(mateMatch[1]);
  } else if (cpMatch) {
    score = parseInt(cpMatch[1]);
  }

  const pvMatch = line.match(/\bpv (.+?)(?:\s+(?:bmc|tbhits|string|currmove)\b|$)/);
  const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

  return { multipv, depth, score, mate, pv };
}

/** Parse a UCI `bestmove` line. Returns the UCI move string or null. */
export function parseBestMove(line: string): string | null {
  const m = line.match(/^bestmove (\S+)/);
  return m && m[1] !== "(none)" ? m[1] : null;
}

/** Format a score for display. */
export function formatScore(score: number | null, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `M${mate}` : `−M${Math.abs(mate)}`;
  }
  if (score === null) return "—";
  const abs = Math.abs(score / 100);
  const sign = score >= 0 ? "+" : "−";
  return `${sign}${abs.toFixed(1)}`;
}

/**
 * Convert the first N UCI moves of a PV into SAN strings, starting from `fen`.
 * Returns as many SAN moves as could be applied before an illegal move.
 */
export function pvToSan(pv: string[], fen: string, maxMoves = 5): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of pv.slice(0, maxMoves)) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      const result = chess.move({ from, to, promotion });
      if (!result) break;
      san.push(result.san);
    } catch {
      break;
    }
  }
  return san;
}

/** Clamp eval bar percentage (0–100), where 50 = equal. */
export function evalToBarPct(score: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 95 : 5;
  if (score === null) return 50;
  // ±800cp maps to ~95%/5%; clamp to [5, 95]
  const pct = 50 + (score / 800) * 45;
  return Math.min(95, Math.max(5, pct));
}
