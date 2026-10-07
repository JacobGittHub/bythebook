// A book, or the Explorer's explored line, as the book views draw it (`src/components/books/`).
// Built once per tree, it adds what every view's layout needs: each node's parent, ply,
// size and line count, with siblings in a fixed order. Pure, so the layouts' property tests
// run on it in Node.

import type { BookSide } from "@/lib/books/measures";

/** What a view tree is built from: a `MoveNode`, or a node with master games attached. */
export type ViewSource = {
  id: string;
  san: string | null;
  uci: string | null;
  fen: string;
  /** Master games that played this move, when known. */
  games?: number | null;
  /** Sorts before its siblings: the Explorer's played line, which every view draws as its main line. */
  pinned?: boolean;
  children: readonly ViewSource[];
};

export type ViewNode = {
  id: string;
  san: string | null;
  uci: string | null;
  fen: string;
  /** Plies from the game's start to this position: 0 at the starting position. */
  ply: number;
  /** Moves from the view's root. */
  depth: number;
  parent: ViewNode | null;
  /** Heaviest first (`compareSiblings`). */
  children: ViewNode[];
  /** Positions at and below this one. The root doesn't count itself, as in `countPositions`. */
  size: number;
  /** Lines through this position: its leaves. */
  leaves: number;
  games: number | null;
};

export type ViewTree = {
  root: ViewNode;
  /** Every node, the root first, each before its children (pre-order). */
  nodes: ViewNode[];
  byId: Map<string, ViewNode>;
  maxDepth: number;
};

/** The ply of a position from its FEN's move number and side to move. */
export function plyOfFen(fen: string): number {
  const fields = fen.trim().split(/\s+/);
  const fullmove = Number.parseInt(fields[5] ?? "1", 10);
  return (Number.isFinite(fullmove) && fullmove > 0 ? fullmove - 1 : 0) * 2 + (fields[1] === "b" ? 1 : 0);
}

/**
 * A pinned move sorts first. The rest sort by master games when every sibling has a count,
 * otherwise by the positions behind them, then by UCI, so the order never changes between
 * runs (`AGENTS.md`).
 */
function sortSiblings(children: ViewNode[], pinned: ReadonlySet<string>) {
  const byGames = children.every((child) => child.games !== null);
  children.sort(
    (a, b) =>
      Number(pinned.has(b.id)) - Number(pinned.has(a.id)) ||
      (byGames ? (b.games ?? 0) - (a.games ?? 0) : b.size - a.size) ||
      (a.uci ?? "").localeCompare(b.uci ?? ""),
  );
}

export function buildViewTree(source: ViewSource): ViewTree {
  const nodes: ViewNode[] = [];
  const byId = new Map<string, ViewNode>();
  const rootPly = plyOfFen(source.fen);
  const pinned = new Set<string>();
  let maxDepth = 0;

  const build = (from: ViewSource, parent: ViewNode | null, depth: number): ViewNode => {
    const node: ViewNode = {
      id: from.id,
      san: from.san,
      uci: from.uci,
      fen: from.fen,
      ply: rootPly + depth,
      depth,
      parent,
      children: [],
      size: 0,
      leaves: 0,
      games: from.games ?? null,
    };
    maxDepth = Math.max(maxDepth, depth);
    if (from.pinned) pinned.add(from.id);
    node.children = from.children.map((child) => build(child, node, depth + 1));
    sortSiblings(node.children, pinned);
    node.size = node.children.reduce((total, child) => total + child.size, depth > 0 ? 1 : 0);
    node.leaves = node.children.length
      ? node.children.reduce((total, child) => total + child.leaves, 0)
      : 1;
    return node;
  };

  const root = build(source, null, 0);
  // Pre-order after sorting, so the list follows the drawn order.
  const visit = (node: ViewNode) => {
    nodes.push(node);
    byId.set(node.id, node);
    node.children.forEach(visit);
  };
  visit(root);
  return { root, nodes, byId, maxDepth };
}

/** The nodes from the root to `node`, both included. */
export function pathTo(node: ViewNode): ViewNode[] {
  const path: ViewNode[] = [];
  for (let current: ViewNode | null = node; current; current = current.parent) path.unshift(current);
  return path;
}

/** The leaf reached by always taking the heaviest move: the main line below `node`. */
export function heavyLeaf(node: ViewNode): ViewNode {
  let current = node;
  while (current.children.length) current = current.children[0];
  return current;
}

/** True when `ancestor` is `node` or lies on the path to it. */
export function isAncestorOrSelf(ancestor: ViewNode, node: ViewNode): boolean {
  for (let current: ViewNode | null = node; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

/** True when the move into this position was White's. */
export function isWhiteMove(node: ViewNode): boolean {
  return node.ply % 2 === 1;
}

export function sideToMove(node: ViewNode): BookSide {
  return node.ply % 2 === 0 ? "white" : "black";
}

/** A position where the book's own side has more than one move (`findClashes`, D6). */
export function isClash(node: ViewNode, side: BookSide): boolean {
  return node.children.length > 1 && sideToMove(node) === side;
}

/** "5.Bf5" for White's move, "5...Bf5" for Black's, "Start" for the root. */
export function moveLabel(node: ViewNode): string {
  if (!node.san) return "Start";
  const number = Math.ceil(node.ply / 2);
  return isWhiteMove(node) ? `${number}.${node.san}` : `${number}...${node.san}`;
}

/** "1.d4 d5 2.c4", numbering a first move by Black as "1...d5". Empty for the root alone. */
export function lineText(nodes: readonly ViewNode[]): string {
  return nodes
    .filter((node) => node.san)
    .map((node, i) => (isWhiteMove(node) || i === 0 ? moveLabel(node) : node.san))
    .join(" ");
}

/** How many families a view colors; later families share the last color. */
export const FAMILY_COLORS = 8;

/**
 * Each node's family: the main lines the tree splits into where it first branches, in sibling
 * order, so the heaviest line is family 0. The trunk above the split has none (-1).
 */
export function families(tree: ViewTree): Map<string, number> {
  const family = new Map<string, number>();
  let trunkEnd = tree.root;
  family.set(trunkEnd.id, -1);
  while (trunkEnd.children.length === 1) {
    trunkEnd = trunkEnd.children[0];
    family.set(trunkEnd.id, -1);
  }
  const mark = (node: ViewNode, index: number) => {
    family.set(node.id, index);
    node.children.forEach((child) => mark(child, index));
  };
  trunkEnd.children.forEach((child, i) => mark(child, Math.min(i, FAMILY_COLORS - 1)));
  return family;
}
