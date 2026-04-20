import type { ExplorerResponse } from "@/types/chess";

type LichessMasterMove = {
  san: string;
  uci: string;
  white: number;
  draws: number;
  black: number;
};

type LichessMasterResponse = {
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
  const url = new URL("https://explorer.lichess.ovh/master");
  url.searchParams.set("fen", fen);
  url.searchParams.set("moves", "12");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after")) || 60;
    throw new LichessRateLimitError(retryAfter);
  }

  if (!response.ok) {
    throw new Error(`Lichess explorer request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as LichessMasterResponse;

  return {
    moves: (data.moves ?? []).map((move) => ({
      san: move.san,
      uci: move.uci,
      white: move.white,
      draws: move.draws,
      black: move.black,
    })),
    opening: data.opening,
  };
}
