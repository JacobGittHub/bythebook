// Comparing the user's games with a book (plans/game-history.md D10, D27, step 17): each game
// played from the book's side is walked through the book by its moves. A game that leaves the
// book's move order but reaches one of its positions within `REJOIN_PLIES` rejoins the book there
// (transposed); otherwise its first move off the book leaves it, by the user or by the opponent.
// The totals at each book position and the places games leave are what a book's own page shows
// of the user's games.

import type { BookSide } from "@/lib/books/measures";
import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { applyUci, uciToSan } from "@/lib/chess/applyUci";
import { toPositionKey } from "@/lib/chess/fen";
import type { GameRecord, Tally } from "./types";

/**
 * How many plies a game is followed after it leaves the book's move order, looking for a book
 * position to rejoin. A transposition rejoins within a few moves; past this, the game has left.
 */
export const REJOIN_PLIES = 8;

/** Games through a book position, with the user's results. */
export type PositionGames = Tally & { games: number };

/** A place games left the book: a move played at one of its positions that the book doesn't have. */
export type BookExit = {
  /** The book position the move was played at. */
  from: ViewNode;
  uci: string;
  /** The move as written; null if the move player refused it. */
  san: string | null;
  /** Who played it: the user leaving their book, or an opponent the book doesn't answer. */
  by: "you" | "opponent";
  games: number;
  tally: Tally;
};

export type BookComparison = {
  /** The games compared: those played from the book's side. */
  games: number;
  /** Games and results at each book position the games reached, by node id. */
  totals: Map<string, PositionGames>;
  /** Where games left the book, most games first. */
  exits: BookExit[];
  /** Games that reached the end of one of the book's lines. */
  reachedEnd: number;
  /** Games still in the book where their kept moves stop (`GAME_HISTORY_PLIES`). */
  toCutoff: number;
  /** Games that ended inside the book. */
  endedInside: number;
  /** Games that rejoined the book by position at least once (D27). */
  transposed: number;
};

const add = (totals: Map<string, PositionGames>, id: string, result: GameRecord["result"]) => {
  const at = totals.get(id) ?? { games: 0, win: 0, draw: 0, loss: 0 };
  at.games += 1;
  at[result] += 1;
  totals.set(id, at);
};

/** Compares `records` with the book drawn as `tree`, whose side is `side`. */
export function compareWithBook(tree: ViewTree, side: BookSide, records: readonly GameRecord[]): BookComparison {
  // A position reached by several move orders rejoins the first of them the views draw.
  const byPosition = new Map<string, ViewNode>();
  for (const node of tree.nodes) {
    const key = toPositionKey(node.fen);
    if (!byPosition.has(key)) byPosition.set(key, node);
  }

  const totals = new Map<string, PositionGames>();
  const exits = new Map<string, BookExit>();
  const result: BookComparison = { games: 0, totals, exits: [], reachedEnd: 0, toCutoff: 0, endedInside: 0, transposed: 0 };

  for (const record of records) {
    if (record.color !== side) continue;
    result.games += 1;
    const moves = record.moves.split(" ");
    let node = tree.root;
    let rejoined = false;
    let left = false;
    add(totals, node.id, record.result);
    for (let i = 0; i < moves.length && node.children.length; i++) {
      const next = node.children.find((child) => child.uci === moves[i]);
      if (next) {
        node = next;
        add(totals, node.id, record.result);
        continue;
      }
      // Off the book's move order: follow the game a while, in case it reaches a book position.
      let fen: string | null = node.fen;
      let back: ViewNode | undefined;
      let j = i;
      for (; j < moves.length && j - i < REJOIN_PLIES && fen; j++) {
        fen = applyUci(fen, moves[j]);
        back = fen ? byPosition.get(toPositionKey(fen)) : undefined;
        if (back && back.depth > 0) break;
        back = undefined;
      }
      if (back) {
        rejoined = true;
        node = back;
        add(totals, node.id, record.result);
        i = j;
        continue;
      }
      const uci = moves[i];
      const key = `${node.id} ${uci}`;
      const exit = exits.get(key) ?? {
        from: node,
        uci,
        san: uciToSan(node.fen, uci),
        by: node.ply % 2 === (side === "white" ? 0 : 1) ? ("you" as const) : ("opponent" as const),
        games: 0,
        tally: { win: 0, draw: 0, loss: 0 },
      };
      exit.games += 1;
      exit.tally[record.result] += 1;
      exits.set(key, exit);
      left = true;
      break;
    }
    if (rejoined) result.transposed += 1;
    if (left) continue;
    if (!node.children.length) result.reachedEnd += 1;
    else if (record.plies > moves.length) result.toCutoff += 1;
    else result.endedInside += 1;
  }

  result.exits = [...exits.values()].sort(
    (a, b) => b.games - a.games || a.from.ply - b.from.ply || a.uci.localeCompare(b.uci),
  );
  return result;
}
