import type { CatalogMatch, Move } from "@/types/chess";

export type ScriptedBoardMove = {
  id: string;
  from: string;
  to: string;
  promotion?: string;
};

export function getPlaybackSteps(match: CatalogMatch): Move[] {
  return match.moves;
}

export function getRemainingMoves(moves: Move[], currentIndex: number): Move[] {
  return moves.slice(currentIndex);
}

export function toScriptedBoardMove(move: Move, index: number): ScriptedBoardMove {
  const from = move.uci.slice(0, 2);
  const to = move.uci.slice(2, 4);
  const promotion = move.uci.length > 4 ? move.uci.slice(4) : undefined;

  return {
    id: `scripted-${index}-${move.uci}`,
    from,
    to,
    promotion,
  };
}
