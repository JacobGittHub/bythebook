import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines, createRootMoveNode } from "@/lib/chess/moveTree";
import type { Json } from "@/types/database";
import { movesOf, planMigration, type MigrationRow } from "./migrate";
import { summarize } from "./summary";

const treeOf = (...lines: string[]) => buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN);
const json = (value: unknown) => value as Json;

const row = (fields: Partial<MigrationRow>): MigrationRow => ({
  id: "b1",
  color: "white",
  move_node: {},
  trees: null,
  summary: null,
  ...fields,
});

describe("planMigration", () => {
  it("converts an old tree into trees with its summary", () => {
    const tree = treeOf("d4 d5 c4", "d4 Nf6");
    const plan = planMigration(row({ move_node: json(tree), color: "black" }));
    expect(plan).toEqual({ action: "write", reason: "converted", trees: [tree], summary: summarize([tree], "black") });
  });

  it("converts the oldest rows' line arrays, and the column's empty default", () => {
    const lines = [[{ san: "e4", uci: "e2e4" }, { san: "e5", uci: "e7e5" }]];
    const fromLines = planMigration(row({ move_node: json(lines) }));
    expect(fromLines).toMatchObject({ action: "write", reason: "converted", summary: { positions: 2, lines: 1 } });

    const empty = planMigration(row({ move_node: {} }));
    expect(empty).toMatchObject({ action: "write", trees: [createRootMoveNode(START_FEN)], summary: { positions: 0 } });
  });

  it("refuses a row whose moves can't be replayed, and says why", () => {
    const illegal = { fen: START_FEN, children: [{ uci: "e2e5", children: [] }] };
    expect(planMigration(row({ move_node: json(illegal) }))).toEqual({
      action: "refuse",
      detail: "e2e5 isn't legal after the first position.",
    });
  });

  it("keeps a row whose trees and summary agree with its old tree", () => {
    const tree = treeOf("e4 c5");
    const trees = json([tree]);
    expect(planMigration(row({ move_node: json(tree), trees, summary: json(summarize([tree], "white")) }))).toEqual({
      action: "keep",
    });
  });

  it("adds a missing summary to stored trees", () => {
    const tree = treeOf("e4 c5 Nf3");
    expect(planMigration(row({ move_node: json(tree), trees: json([tree]) }))).toMatchObject({
      action: "write",
      reason: "summarized",
      summary: { positions: 3 },
    });
  });

  it("reports trees that disagree with the old tree, and rebuilds them only when asked", () => {
    const older = treeOf("e4 c5");
    const newer = treeOf("e4 c5", "e4 e5");
    const diverged = row({ move_node: json(newer), trees: json([older]), summary: json(summarize([older], "white")) });
    expect(planMigration(diverged)).toEqual({ action: "diverged" });

    const rebuilt = planMigration(diverged, { rebuildDiverged: true });
    expect(rebuilt).toMatchObject({ action: "write", reason: "rebuilt", summary: { positions: 3 } });
    if (rebuilt.action === "write") expect(movesOf(rebuilt.trees)).toBe(movesOf([newer]));
  });
});

describe("movesOf", () => {
  it("compares trees by their moves, whatever the order of siblings", () => {
    expect(movesOf([treeOf("d4 d5", "e4")])).toBe(movesOf([treeOf("e4", "d4 d5")]));
    expect(movesOf([treeOf("d4 d5")])).not.toBe(movesOf([treeOf("d4 Nf6")]));
  });
});
