// Which of a book's moves are drilled (plans/game-history.md D40, D41). At a clash, a position
// where the book's own side has more than one move (bookstore.md D6), the book's owner ticks the
// moves to drill; an unticked move carries `skip` in the book's trees and stays in the book, but
// drills skip it and every line after it. A clash is resolved when one of its moves is ticked,
// and at least one always stays ticked. A clash below an unticked move doesn't count, since
// drills never reach it.

import type { MoveNode } from "@/types/chess";
import { sideToMoveAt, type BookSide } from "./measures";

/** The ticked moves' ids at each clash, by the clash's id. A clash it doesn't name has every move ticked. */
export type Picks = ReadonlyMap<string, ReadonlySet<string>>;

/** Open: two or more moves ticked. Done: one. Off: a move above it is unticked, so drills never reach it. */
export type ClashState = "open" | "done" | "off";

/** What the functions here read of a node: a book's `MoveNode`, or a view's `ViewNode`. */
type Node = { id: string; fen: string; children: readonly Node[] };

export type Clash<N extends Node> = { node: N; state: ClashState; ticked: ReadonlySet<string> };

/** Whether `node` is a clash for `side`. */
export function isClashFor(node: Node, side: BookSide): boolean {
  return node.children.length > 1 && sideToMoveAt(node.fen) === side;
}

/** The moves ticked at `clash` under `picks`: all of them when it names none, or none that are its own. */
export function tickedAt(clash: Node, picks: Picks): ReadonlySet<string> {
  const picked = picks.get(clash.id);
  const own = picked && clash.children.filter((child) => picked.has(child.id)).map((child) => child.id);
  return new Set(own?.length ? own : clash.children.map((child) => child.id));
}

/**
 * The picks a book's tree holds in its moves' `skip` flags. A flag on a move that isn't at a
 * clash is ignored, as is a clash whose moves are all flagged (D41).
 */
export function picksOf(tree: MoveNode, side: BookSide): Map<string, Set<string>> {
  const picks = new Map<string, Set<string>>();
  const walk = (node: MoveNode) => {
    if (isClashFor(node, side)) {
      const ticked = node.children.filter((child) => !child.skip).map((child) => child.id);
      if (ticked.length && ticked.length < node.children.length) picks.set(node.id, new Set(ticked));
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return picks;
}

/** Every clash in tree order, each with its state and ticked moves under `picks`. */
export function clashesOf<N extends Node>(tree: N, side: BookSide, picks: Picks): Clash<N>[] {
  const clashes: Clash<N>[] = [];
  const walk = (node: N, drilled: boolean) => {
    const clash = isClashFor(node, side);
    const ticked = clash ? tickedAt(node, picks) : null;
    if (ticked) clashes.push({ node, state: !drilled ? "off" : ticked.size > 1 ? "open" : "done", ticked });
    for (const child of node.children as readonly N[]) walk(child, drilled && (!ticked || ticked.has(child.id)));
  };
  walk(tree, true);
  return clashes;
}

/** The clashes still to resolve: drilled, with more than one move ticked. */
export function openClashes<N extends Node>(clashes: readonly Clash<N>[]): Clash<N>[] {
  return clashes.filter((clash) => clash.state === "open");
}

/**
 * The tree with its `skip` flags written from `picks`: on each unticked move at a clash, and
 * on no other move. The input is left alone.
 */
export function withPicks(tree: MoveNode, side: BookSide, picks: Picks): MoveNode {
  const copy = (node: MoveNode, skip: boolean): MoveNode => {
    const ticked = isClashFor(node, side) ? tickedAt(node, picks) : null;
    const next: MoveNode = {
      id: node.id,
      san: node.san,
      uci: node.uci,
      fen: node.fen,
      children: node.children.map((child) => copy(child, ticked !== null && !ticked.has(child.id))),
    };
    if (skip) next.skip = true;
    return next;
  };
  return copy(tree, false);
}

/**
 * The move to keep at a clash: the one most of the user's games took (`games`, by move id), then
 * the one with the most lines behind it, then the first.
 */
export function mostPlayed<N extends Node & { leaves: number }>(clash: N, games?: (node: N) => number): N {
  const children = clash.children as readonly N[];
  return children.reduce((best, child) => {
    const byGames = games ? games(child) - games(best) : 0;
    return byGames > 0 || (byGames === 0 && child.leaves > best.leaves) ? child : best;
  });
}
