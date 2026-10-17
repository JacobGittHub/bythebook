// The tree the Explorer's side window draws: the line played so far, the master moves that
// weren't played at each of its positions, and the master moves from the current position.
// The book views draw it like any book; the played line is pinned so it is every view's main
// line. Pure: `OpeningExplorer` passes in the master numbers it already fetched.

import { gameCount } from "@/lib/chess/explorerData";
import { START_FEN, fenAfterUci } from "@/lib/chess/fen";
import { createMoveNodeId } from "@/lib/chess/moveTree";
import type { ExplorerMove, MoveNode } from "@/types/chess";
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

export type BookLineTree = {
  source: ViewSource;
  /** The current position's id. */
  currentId: string;
  /** Whether the line played left the book. */
  out: boolean;
};

/**
 * The Explorer's view of its chosen book (plans/book-ui.md D17): the book's tree, with the moves
 * played past its end added from where the line left it, marked `out`, so the views draw them
 * dashed. Only the nodes along the played line are copied; the rest are the book's own.
 */
export function bookLineTree(book: MoveNode, history: readonly Pick<Played, "san" | "uci" | "fen">[]): BookLineTree {
  const follow = (node: ViewSource, i: number): BookLineTree => {
    if (i === history.length) return { source: node, currentId: node.id, out: false };
    const child = node.children.find((candidate) => candidate.uci === history[i].uci);
    if (child) {
      const below = follow(child, i + 1);
      return { ...below, source: { ...node, children: node.children.map((c) => (c === child ? below.source : c)) } };
    }
    const ids: string[] = [];
    for (let k = i, parentId = node.id; k < history.length; k++) {
      parentId = createMoveNodeId(parentId, history[k].uci);
      ids.push(parentId);
    }
    let chain: ViewSource | null = null;
    for (let k = history.length - 1; k >= i; k--) {
      const { san, uci, fen } = history[k];
      chain = { id: ids[k - i], san, uci, fen, out: true, children: chain ? [chain] : [] };
    }
    return { source: { ...node, children: [...node.children, chain!] }, currentId: ids[ids.length - 1], out: true };
  };
  return follow(book, 0);
}
