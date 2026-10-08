// Turns any JSON into a book's trees, or the reason it can't (plans/deployment.md Phase 5).
// The server, the browser library, Restore and the copy at sign-in all save through it, so a
// tree is never trusted for anything but its moves: every move is replayed with chess.js from
// its tree's first position, and positions, SAN and ids are rebuilt from the replay.

import { Chess } from "chess.js";
import { checkPositionLimit } from "@/lib/books/measures";
import { START_FEN, isValidFen, normalizeFen, toPositionKey } from "@/lib/chess/fen";
import { createMoveNodeId, createRootMoveNode } from "@/lib/chess/moveTree";
import type { MoveNode } from "@/types/chess";

/**
 * The most nodes a tree list may hold before replaying, repeats included: well above any
 * book's limit, so a repeated move is merged before the limit is checked, and low enough that
 * a huge input is refused before chess.js sees it.
 */
export const MAX_RAW_NODES = 20_000;

/** The longest line a book may hold, in moves. Openings end long before this. */
export const MAX_LINE_MOVES = 300;

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export type ValidationResult =
  | { ok: true; trees: MoveNode[]; positions: number }
  | { ok: false; reason: "invalid"; detail: string }
  | { ok: false; reason: "over_limit"; count: number; limit: number };

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = (detail: string): ValidationResult => ({ ok: false, reason: "invalid", detail });

/** Checks the input's shape and size without recursion, so a deep input can't overflow the stack. */
function checkShape(input: unknown): string | null {
  if (!Array.isArray(input)) return "A book's trees must be a list.";
  const stack: [unknown, number][] = input.map((tree) => [tree, 0]);
  let nodes = 0;
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (++nodes > MAX_RAW_NODES) return "The book is far too large.";
    if (depth > MAX_LINE_MOVES) return `A line is longer than ${MAX_LINE_MOVES} moves.`;
    if (!isRecord(node)) return "A move isn't an object.";
    const children = node.children ?? [];
    if (!Array.isArray(children)) return "A move's children aren't a list.";
    for (const child of children) stack.push([child, depth + 1]);
  }
  return null;
}

/** Plays `raw`'s children from `target`'s position into `target`, merging repeated moves. */
function grow(target: MoveNode, raw: Raw, game: Chess, line: string[]): string | null {
  for (const child of (raw.children ?? []) as Raw[]) {
    const uci = child.uci;
    if (typeof uci !== "string" || !UCI.test(uci)) {
      return `A move after ${lineName(line)} isn't written as a move.`;
    }
    let played;
    try {
      played = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      return `${uci} isn't legal after ${lineName(line)}.`;
    }

    let node = target.children.find((existing) => existing.uci === played.lan);
    if (!node) {
      node = {
        id: createMoveNodeId(target.id, played.lan),
        san: played.san,
        uci: played.lan,
        fen: game.fen(),
        children: [],
      };
      target.children.push(node);
    }
    const problem = grow(node, child, game, [...line, played.san]);
    game.undo();
    if (problem) return problem;
  }
  return null;
}

const lineName = (line: string[]) => (line.length ? line.join(" ") : "the first position");

/**
 * The trees of a book, rebuilt from `input`, a list of trees as `MoveNode`s. Only each tree's
 * first position and each move's UCI are read. Trees that start from the same position are
 * merged, as are repeated moves, and trees without moves are dropped; a book with no moves
 * at all is one empty tree from the starting position. The book must keep within its
 * position limit (bookstore.md D15).
 */
export function validateTrees(
  input: unknown,
  options: { verifiedPublisher?: boolean } = {},
): ValidationResult {
  const shapeProblem = checkShape(input);
  if (shapeProblem) return invalid(shapeProblem);

  const trees: MoveNode[] = [];
  const byStart = new Map<string, MoveNode>();
  for (const raw of input as Raw[]) {
    if (typeof raw.fen !== "string" || !isValidFen(normalizeFen(raw.fen))) {
      return invalid("A tree's first position isn't a valid FEN.");
    }
    const game = new Chess(normalizeFen(raw.fen));
    const key = toPositionKey(game.fen());
    let tree = byStart.get(key);
    if (!tree) {
      tree = createRootMoveNode(game.fen());
      byStart.set(key, tree);
      trees.push(tree);
    }
    const problem = grow(tree, raw, game, []);
    if (problem) return invalid(problem);
  }

  const kept = trees.filter((tree) => tree.children.length > 0);
  const result = kept.length ? kept : [createRootMoveNode(START_FEN)];
  const { count, limit, over } = checkPositionLimit(result, options.verifiedPublisher ?? false);
  if (over) return { ok: false, reason: "over_limit", count, limit };
  return { ok: true, trees: result, positions: count };
}
