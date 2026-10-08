// What `npm run books:migrate` does to one `opening_books` row (plans/deployment.md Phase 5,
// D28): a row from before the library has only `move_node`, which becomes `trees` with its
// summary. Old rows hold one tree or the oldest line arrays (`legacyTrees`), and every move is
// replayed, so a row that can't be read is reported and left as it is.
//
// A row that already has trees is checked against `move_node`: the library writes both until
// Migration B, so they disagree only when code from before the library edited the book after
// its trees were written. Such a row is reported, and rebuilt from `move_node` only when asked.

import { toPositionKey } from "@/lib/chess/fen";
import type { Json } from "@/types/database";
import type { MoveNode } from "@/types/chess";
import { summarize } from "./summary";
import { startTree, withStartTree } from "./trees";
import type { BookSummary } from "./types";
import { legacyTrees, validateTrees, type ValidationResult } from "./validate";

export type MigrationRow = {
  id: string;
  color: string;
  move_node: Json;
  trees: Json | null;
  summary: Json | null;
};

export type RowPlan =
  /** Trees and summary are there, and agree with `move_node`. */
  | { action: "keep" }
  | {
      action: "write";
      /** From `move_node`, a summary for stored trees, or stored trees rebuilt from `move_node`. */
      reason: "converted" | "summarized" | "rebuilt";
      trees: MoveNode[];
      summary: BookSummary;
    }
  /** Trees are there, but `move_node` holds other moves; written only with `rebuildDiverged`. */
  | { action: "diverged" }
  | { action: "refuse"; detail: string };

/** Old books are never refused for their size below a verified publisher's limit. */
const read = (input: unknown) => validateTrees(input, { verifiedPublisher: true });

function problem(result: Exclude<ValidationResult, { ok: true }>): string {
  return result.reason === "over_limit"
    ? `${result.count.toLocaleString("en-US")} positions, over even a verified publisher's ${result.limit.toLocaleString("en-US")}.`
    : result.detail;
}

/** Every line's moves from its first position, sorted, so trees compare by moves alone. */
export function movesOf(trees: readonly MoveNode[]): string {
  const lines: string[] = [];
  const walk = (node: MoveNode, prefix: string) => {
    for (const child of node.children) {
      const line = `${prefix} ${child.uci}`;
      lines.push(line);
      walk(child, line);
    }
  };
  for (const tree of trees) walk(tree, toPositionKey(tree.fen));
  return lines.sort().join("\n");
}

export function planMigration(row: MigrationRow, options: { rebuildDiverged?: boolean } = {}): RowPlan {
  const side = row.color === "black" ? "black" : "white";
  const legacy = read(legacyTrees(row.move_node));

  if (!Array.isArray(row.trees)) {
    if (!legacy.ok) return { action: "refuse", detail: problem(legacy) };
    return { action: "write", reason: "converted", trees: legacy.trees, summary: summarize(legacy.trees, side) };
  }

  const stored = read(row.trees);
  if (!stored.ok) return { action: "refuse", detail: `Its stored trees can't be read: ${problem(stored)}` };

  // A `move_node` that can't be read is dropped with the column; the trees are the book.
  const legacyStart = legacy.ok ? startTree(legacy.trees) : null;
  if (legacyStart && movesOf([legacyStart]) !== movesOf([startTree(stored.trees)])) {
    if (!options.rebuildDiverged) return { action: "diverged" };
    const trees = withStartTree(stored.trees, legacyStart).filter((tree) => tree.children.length > 0);
    const rebuilt = read(trees);
    if (!rebuilt.ok) return { action: "refuse", detail: problem(rebuilt) };
    return { action: "write", reason: "rebuilt", trees: rebuilt.trees, summary: summarize(rebuilt.trees, side) };
  }

  if (row.summary === null) {
    return { action: "write", reason: "summarized", trees: stored.trees, summary: summarize(stored.trees, side) };
  }
  return { action: "keep" };
}
