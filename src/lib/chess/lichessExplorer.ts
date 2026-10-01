import { EXPLORER_MOVES_LIMIT } from "@/lib/chess/explorerData";
import type { ExplorerResponse } from "@/types/chess";

type LichessMasterMove = {
  san: string;
  uci: string;
  white: number;
  draws: number;
  black: number;
};

type LichessMasterResponse = {
  white?: number;
  draws?: number;
  black?: number;
  moves?: LichessMasterMove[];
  opening?: {
    eco?: string;
    name?: string;
  };
};

export class LichessRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds = 60) {
    super("Lichess Opening Explorer rate limit exceeded.");
    this.name = "LichessRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function fetchExplorerMoves(fen: string): Promise<ExplorerResponse> {
  const url = new URL("https://explorer.lichess.ovh/masters");
  url.searchParams.set("fen", fen);
  url.searchParams.set("moves", String(EXPLORER_MOVES_LIMIT));

  const token = process.env.LICHESS_API_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn("⚠️ LICHESS_API_TOKEN is missing. Requests will likely fail with 401 Unauthorized.");
  }

  const response = await fetch(url, {
    headers,
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after")) || 60;
    throw new LichessRateLimitError(retryAfter);
  }

  if (!response.ok) {
    throw new Error(`Lichess explorer request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as LichessMasterResponse;
  const moves = (data.moves ?? []).map((move) => ({
    san: move.san,
    uci: move.uci,
    white: move.white,
    draws: move.draws,
    black: move.black,
  }));

  // Lichess always sends the position totals; summing the listed moves is only a fallback.
  const sum = (key: "white" | "draws" | "black") => moves.reduce((total, m) => total + m[key], 0);

  return {
    moves,
    opening: data.opening,
    totals: {
      white: data.white ?? sum("white"),
      draws: data.draws ?? sum("draws"),
      black: data.black ?? sum("black"),
    },
    movesLimit: EXPLORER_MOVES_LIMIT,
  };
}
