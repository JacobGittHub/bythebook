// The game history's tree (plans/game-history.md D19, D30): the chosen games grouped by their
// shared moves, with the user's results at each position, as the book views draw it. It is built
// in the browser from the records and never stored. Whichever side the user played, the results
// are theirs, so with both sides chosen the tree holds every game from the starting position.
//
// Positions and move names come from the move player (`applyUci`, `uciToSan`), and a page keeps
// them in `PositionNames` between builds, so changing the filters only counts games again.

import { applyUci, uciToSan } from "@/lib/chess/applyUci";
import { START_FEN } from "@/lib/chess/fen";
import { createMoveNodeId } from "@/lib/chess/moveTree";
import type { ViewSource } from "@/lib/books/viewTree";
import type { GameRecord, Tally } from "./types";

/**
 * Plies drawn of a line only one game took, from the move where it left every other game. Past
 * that the line is cut, so a long history stays small enough to draw.
 */
export const HISTORY_TAIL_PLIES = 1;

/** The position and move name after each line of UCI moves, kept between builds. */
export type PositionNames = Map<string, { fen: string; san: string } | null>;

export type HistoryTree = {
  /** For `buildViewTree`: each node's `games` is the games that reached it. */
  source: ViewSource;
  /** The user's results from each drawn position, by node id. */
  results: Map<string, Tally>;
  /** The UCI moves to each drawn position, by node id ("" for the root), for `gamesThrough`. */
  lines: Map<string, string>;
};

type Count = { games: number; tally: Tally; children: Map<string, Count> };

const newCount = (): Count => ({ games: 0, tally: { win: 0, draw: 0, loss: 0 }, children: new Map() });

export function buildHistoryTree(records: readonly GameRecord[], names: PositionNames = new Map()): HistoryTree {
  const top = newCount();
  for (const record of records) {
    let count = top;
    count.games += 1;
    count.tally[record.result] += 1;
    for (const uci of record.moves.split(" ")) {
      let child = count.children.get(uci);
      if (!child) count.children.set(uci, (child = newCount()));
      child.games += 1;
      child.tally[record.result] += 1;
      count = child;
    }
  }

  const results = new Map<string, Tally>();
  const lines = new Map<string, string>();
  /** The position and name after `uci` from `fen`; null for a move the move player refuses (D20). */
  const named = (line: string, fen: string, uci: string) => {
    let known = names.get(line);
    if (known === undefined) {
      const next = applyUci(fen, uci);
      const san = next && uciToSan(fen, uci);
      names.set(line, (known = next && san ? { fen: next, san } : null));
    }
    return known;
  };

  const draw = (count: Count, node: ViewSource, line: string, alone: number): ViewSource => {
    results.set(node.id, count.tally);
    lines.set(node.id, line);
    const children: ViewSource[] = [];
    for (const [uci, child] of count.children) {
      const lonely = child.games === 1 ? alone + 1 : 0;
      if (lonely > HISTORY_TAIL_PLIES) continue;
      const childLine = line ? `${line} ${uci}` : uci;
      const position = named(childLine, node.fen, uci);
      if (!position) continue;
      const id = createMoveNodeId(node.id, uci);
      children.push(draw(child, { id, san: position.san, uci, fen: position.fen, games: child.games, children: [] }, childLine, lonely));
    }
    return { ...node, children };
  };

  const source = draw(top, { id: "root", san: null, uci: null, fen: START_FEN, games: top.games, children: [] }, "", 0);
  return { source, results, lines };
}

/** The games through the position reached by `line` (UCI separated by spaces; "" for every game). */
export function gamesThrough<T extends { record: GameRecord }>(games: readonly T[], line: string): T[] {
  if (!line) return [...games];
  return games.filter(({ record }) => record.moves === line || record.moves.startsWith(`${line} `));
}

/** The user's score from a tally: wins count one, draws half; null with no games. */
export function scoreOf(tally: Tally): number | null {
  const games = tally.win + tally.draw + tally.loss;
  return games ? (tally.win + tally.draw / 2) / games : null;
}
