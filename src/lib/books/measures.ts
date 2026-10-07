// What a book's cards and limits say about it (plans/bookstore.md, D6, D9, D11, D15, D16).
// A book is a list of trees, each starting from a position (D16); an ordinary book is one
// tree from the starting position. Everything here is pure, so it runs in the browser, in
// the publishing script and in tests alike.

import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import type { MoveNode } from "@/types/chess";

/** The side a book is played from, as `opening_books.color` stores it. */
export type BookSide = "white" | "black";

/** The most positions a book may hold (D15). */
export const MAX_BOOK_POSITIONS = 1_000;

/** The most positions a verified publisher's book may hold (D15). */
export const MAX_VERIFIED_BOOK_POSITIONS = 5_000;

export function positionLimit(verifiedPublisher: boolean): number {
  return verifiedPublisher ? MAX_VERIFIED_BOOK_POSITIONS : MAX_BOOK_POSITIONS;
}

function sideToMove(fen: string): BookSide {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

/**
 * Positions in a book: one for each move, so a tree's first position doesn't count. A
 * position reached by two move orders counts twice, as the tree stores it twice.
 */
export function countPositions(trees: readonly MoveNode[]): number {
  const count = (node: MoveNode): number =>
    node.children.reduce((total, child) => total + 1 + count(child), 0);
  return trees.reduce((total, tree) => total + count(tree), 0);
}

export type PositionCount = { count: number; limit: number; over: boolean };

/** The count shown against the limit ("198 / 1,000"), and whether it is over. */
export function checkPositionLimit(
  trees: readonly MoveNode[],
  verifiedPublisher: boolean,
): PositionCount {
  const count = countPositions(trees);
  const limit = positionLimit(verifiedPublisher);
  return { count, limit, over: count > limit };
}

/**
 * True when a book has more than one tree, or its one tree doesn't start from the starting
 * position: the "unconnected lines" flag on its card (D16).
 */
export function hasUnconnectedLines(trees: readonly MoveNode[]): boolean {
  if (trees.length > 1) return true;
  return trees.length === 1 && toPositionKey(trees[0].fen) !== toPositionKey(START_FEN);
}

/**
 * The depth of each leaf position, in plies from its tree's first position. A leaf position
 * reached by several move orders counts once, at the shortest (D9).
 */
export function leafDepths(trees: readonly MoveNode[]): number[] {
  const shortest = new Map<string, number>();
  const walk = (node: MoveNode, depth: number) => {
    if (node.children.length === 0) {
      if (depth === 0) return;
      const key = toPositionKey(node.fen);
      shortest.set(key, Math.min(depth, shortest.get(key) ?? Infinity));
      return;
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const tree of trees) walk(tree, 0);
  return [...shortest.values()];
}

/** The average of `leafDepths`, or null for a book without moves. */
export function averageLeafDepth(trees: readonly MoveNode[]): number | null {
  const depths = leafDepths(trees);
  return depths.length ? depths.reduce((sum, depth) => sum + depth, 0) / depths.length : null;
}

/** The positions where the book's own side has more than one move: its clashes (D6). */
export function findClashes(trees: readonly MoveNode[], side: BookSide): MoveNode[] {
  const clashes: MoveNode[] = [];
  const walk = (node: MoveNode) => {
    if (node.children.length > 1 && sideToMove(node.fen) === side) clashes.push(node);
    node.children.forEach(walk);
  };
  trees.forEach(walk);
  return clashes;
}

/** A master move from a position, with the number of games that played it. */
export type MasterMove = { uci: string; games: number };

/** The master moves from a position, by position key, or null where none are saved. */
export type MasterMovesLookup = (positionKey: string) => readonly MasterMove[] | null;

/** Shares of master games, adding up to 1. */
export type Coverage = {
  /** Stay in the book until one of its leaves: the book–repertoire scale (D11). */
  covered: number;
  /** Leave on a move by the other side that the book doesn't have. */
  escaped: number;
  /** Reach a position where the other side moves and no master games are saved. */
  unknown: number;
};

const gamesFrom = (moves: readonly MasterMove[] | null) =>
  moves ? moves.reduce((total, move) => total + move.games, 0) : 0;

/**
 * How much of master play a book catches (D11). From each tree's first position, games flow
 * down the moves: where the book's side moves they follow the book's moves, split by how
 * often masters played them (evenly without numbers), and where the other side moves they
 * split by how often masters played each reply, and the replies the book lacks escape. A
 * position's total is the sum of its listed moves. A book of several trees weighs each by the
 * master games at its first position, evenly when none are saved. Null for a book without
 * moves.
 */
export function coverage(
  trees: readonly MoveNode[],
  side: BookSide,
  lookup: MasterMovesLookup,
): Coverage | null {
  const withMoves = trees.filter((tree) => tree.children.length > 0);
  if (withMoves.length === 0) return null;

  const weights = withMoves.map((tree) => gamesFrom(lookup(toPositionKey(tree.fen))));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const result: Coverage = { covered: 0, escaped: 0, unknown: 0 };

  const flow = (node: MoveNode, share: number) => {
    if (share === 0) return;
    if (node.children.length === 0) {
      result.covered += share;
      return;
    }

    const moves = lookup(toPositionKey(node.fen));
    const gamesOf = (child: MoveNode) =>
      moves?.find((move) => move.uci === child.uci)?.games ?? 0;

    if (sideToMove(node.fen) === side) {
      const bookGames = node.children.reduce((sum, child) => sum + gamesOf(child), 0);
      for (const child of node.children) {
        flow(child, bookGames > 0 ? (share * gamesOf(child)) / bookGames : share / node.children.length);
      }
      return;
    }

    const total = gamesFrom(moves);
    if (total === 0) {
      result.unknown += share;
      return;
    }
    let kept = 0;
    for (const child of node.children) {
      kept += gamesOf(child);
      flow(child, (share * gamesOf(child)) / total);
    }
    result.escaped += (share * (total - kept)) / total;
  };

  withMoves.forEach((tree, index) =>
    flow(tree, totalWeight > 0 ? weights[index] / totalWeight : 1 / withMoves.length),
  );
  return result;
}
