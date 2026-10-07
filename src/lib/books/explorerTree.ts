// The tree the Explorer's side window draws: the line played so far, the master moves that
// weren't played at each of its positions, and the master moves from the current position.
// The book views draw it like any book; the played line is pinned so it is every view's main
// line. Pure: `OpeningExplorer` passes in the master numbers it already fetched.

import { gameCount } from "@/lib/chess/explorerData";
import { START_FEN, fenAfterUci } from "@/lib/chess/fen";
import { createMoveNodeId } from "@/lib/chess/moveTree";
import type { ExplorerMove } from "@/types/chess";
import type { ViewSource } from "./viewTree";

/** How many unplayed master moves each played position shows. */
export const EXPLORER_ALTERNATES = 5;
/** How many master moves the current position shows. */
export const EXPLORER_CONTINUATIONS = 4;

type Played = { san: string; uci: string; fen: string };

export type ExplorerTreeInput = {
  history: readonly Played[];
  /** The master moves at the position before each played move (index i: before move i), when loaded. */
  before: readonly (readonly ExplorerMove[] | null)[];
  /** The master moves at the current position. */
  next: readonly ExplorerMove[];
};

export type ExplorerTree = {
  source: ViewSource;
  /** The current position's id. */
  currentId: string;
  /** The master numbers of each drawn move that has them, by node id. */
  stats: Map<string, ExplorerMove>;
};

type Draft = {
  id: string;
  san: string | null;
  uci: string | null;
  fen: string;
  games: number | null;
  pinned: boolean;
  children: Draft[];
};

export function explorerTree({ history, before, next }: ExplorerTreeInput): ExplorerTree {
  const stats = new Map<string, ExplorerMove>();
  const leaves = (parent: Draft, moves: readonly ExplorerMove[], skip: string | null, count: number): Draft[] =>
    moves
      .filter((move) => move.uci !== skip && gameCount(move) > 0)
      .slice(0, count)
      .flatMap((move) => {
        const fen = fenAfterUci(parent.fen, move.uci);
        if (!fen) return [];
        const id = createMoveNodeId(parent.id, move.uci);
        stats.set(id, move);
        return [{ id, san: move.san, uci: move.uci, fen, games: gameCount(move), pinned: false, children: [] }];
      });

  const root: Draft = { id: "root", san: null, uci: null, fen: START_FEN, games: null, pinned: true, children: [] };
  let current = root;
  history.forEach((move, i) => {
    const masters = before[i] ?? null;
    const played = masters?.find((candidate) => candidate.uci === move.uci);
    const id = createMoveNodeId(current.id, move.uci);
    if (played) stats.set(id, played);
    const child: Draft = {
      id,
      san: move.san,
      uci: move.uci,
      fen: move.fen,
      games: played ? gameCount(played) : null,
      pinned: true,
      children: [],
    };
    current.children = [child, ...leaves(current, masters ?? [], move.uci, EXPLORER_ALTERNATES)];
    current = child;
  });
  current.children = leaves(current, next, null, EXPLORER_CONTINUATIONS);
  return { source: root, currentId: current.id, stats };
}
