// One player's games as move statistics (plans/bookstore.md Q1): how often they played each
// move from each position, so `growBook` can grow a book from what they play and `coverage`
// can say how much of their games a book catches. `npm run books:players` reads the games
// from the player's public history; this module only counts them. Pure.

import { applyUci } from "@/lib/chess/applyUci";
import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { getOpeningEndingAt, getOpeningForLine } from "@/lib/chess/openingCatalog";
import type { GrowLookup } from "@/lib/books/grow";
import type { BookSide, MasterMovesLookup } from "@/lib/books/measures";
import type { GameRecord } from "@/lib/history/types";

/** Games that played each move, by position key, then by UCI move. */
export type PlayerMoves = Map<string, Map<string, number>>;

/** The position before each of a game's moves, with the move; stops at a move that isn't legal. */
function positions(moves: string): { fen: string; uci: string }[] {
  const steps: { fen: string; uci: string }[] = [];
  let fen = START_FEN;
  for (const uci of moves.split(" ").filter(Boolean)) {
    const next = applyUci(fen, uci);
    if (!next) break;
    steps.push({ fen, uci });
    fen = next;
  }
  return steps;
}

/**
 * Counts every move of every game from the position it was played in, so games that reach a
 * position by different orders count together. A game that passes a position twice counts once.
 */
export function countPlayerMoves(records: readonly Pick<GameRecord, "moves">[]): PlayerMoves {
  const counts: PlayerMoves = new Map();
  for (const record of records) {
    const seen = new Set<string>();
    for (const { fen, uci } of positions(record.moves)) {
      const key = toPositionKey(fen);
      if (seen.has(`${key} ${uci}`)) continue;
      seen.add(`${key} ${uci}`);
      let moves = counts.get(key);
      if (!moves) counts.set(key, (moves = new Map()));
      moves.set(uci, (moves.get(uci) ?? 0) + 1);
    }
  }
  return counts;
}

/** The moves from a position as `coverage` takes them, or null where no game was played. */
export function playerMovesLookup(counts: PlayerMoves): MasterMovesLookup {
  return (positionKey) => {
    const moves = counts.get(positionKey);
    return moves ? [...moves].map(([uci, games]) => ({ uci, games })) : null;
  };
}

/** The moves from a position as `growBook` takes them: its total is the games that moved on. */
export function playerGrowLookup(counts: PlayerMoves): GrowLookup {
  const lookup = playerMovesLookup(counts);
  return async (fen) => {
    const moves = lookup(toPositionKey(fen));
    return moves ? { moves, total: moves.reduce((sum, move) => sum + move.games, 0) } : null;
  };
}

// "Queen's Gambit" names a family of openings, not a gambit, so it doesn't count; its own
// gambits, such as the Albin Countergambit, still do.
const FAMILY = /^Queen's Gambit( Accepted| Declined)?(:|$)/;

/** Whether an opening's name calls it a gambit. */
export function isGambitName(name: string): boolean {
  return /gambit/i.test(name.replace(FAMILY, ""));
}

/**
 * The gambit a game played, and who offered it: the first position whose catalog name calls it
 * a gambit, and the side whose move reached it. Null for a game that played none.
 */
export function gambitOf(record: Pick<GameRecord, "moves">): { name: string; by: BookSide } | null {
  const steps = positions(record.moves);
  for (let i = 0; i < steps.length; i++) {
    const fen = applyUci(steps[i].fen, steps[i].uci);
    const opening = fen ? getOpeningEndingAt(fen) : undefined;
    if (opening && isGambitName(opening.name)) return { name: opening.name, by: i % 2 === 0 ? "white" : "black" };
  }
  return null;
}

/**
 * The opening a game ended up in: the catalog's name for its deepest named position, or null.
 * A name can come before the choice that settles it ("King's Indian Defense" is named at
 * 3.Nc3, before 3...Bg7 or the Grünfeld's 3...d5), so the deepest name is the one to trust.
 */
export function openingOf(record: Pick<GameRecord, "moves">): string | null {
  const fens = positions(record.moves).map(({ fen, uci }) => applyUci(fen, uci)!);
  return getOpeningForLine(fens)?.name ?? null;
}
