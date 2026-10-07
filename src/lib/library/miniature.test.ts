import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/fen";
import { mulberry32, type Rng } from "@/lib/regions/prng";
import { expectNoViolations } from "@/lib/regions/testShapes";
import type { MoveNode } from "@/types/chess";
import { MAX_MINIATURE_BLOCKS, MINIATURE_MIN_SPAN, MINIATURE_UNITS, apportion, miniature } from "./miniature";

const SEEDS = 120;
const OTHER_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** At most about this many positions per tree, as a book holds (`MAX_BOOK_POSITIONS` and up). */
const NODE_BUDGET = 3_000;

/** A random book of one to three trees. The miniature reads only the shape, so moves are made up. */
function randomTrees(rng: Rng): MoveNode[] {
  const maxDepth = 1 + Math.floor(rng() * 18);
  const bushiness = rng();
  let nodes = 0;
  const build = (id: string, depth: number, fen: string): MoveNode => {
    nodes++;
    const count =
      depth >= maxDepth || nodes > NODE_BUDGET
        ? 0
        : rng() < 0.3 + bushiness * 0.4
          ? 1 + Math.floor(rng() * 5)
          : rng() < 0.75
            ? 1
            : 0;
    return {
      id,
      san: depth ? `m${id.length}` : null,
      uci: depth ? id.slice(-4) : null,
      fen,
      children: Array.from({ length: depth === 0 ? Math.max(count, 1) : count }, (_, k) =>
        build(`${id}:${k}${depth}`, depth + 1, fen),
      ),
    };
  };
  return Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, t) => build("root", 0, t ? OTHER_FEN : START_FEN));
}

/** A tree with its children in reverse order, at every level. */
const reversed = (node: MoveNode): MoveNode => ({ ...node, children: node.children.map(reversed).reverse() });

describe("apportion", () => {
  it("splits whole units that add up to the total", () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(1000, [3, 0, 7])).toEqual([300, 0, 700]);
    expect(apportion(5, [0, 0])).toEqual([0, 0]);
  });
});

describe("miniature", () => {
  it("draws an empty book as one band with no blocks", () => {
    expect(miniature([{ id: "root", san: null, uci: null, fen: START_FEN, children: [] }])).toEqual({
      units: MINIATURE_UNITS,
      depth: 0,
      trees: [[0, MINIATURE_UNITS, 0]],
      blocks: [],
    });
  });

  it("keeps every block inside its parent, siblings apart, and within its limits", () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const mini = miniature(randomTrees(mulberry32(seed)));
      const bandEnd = mini.trees.at(-1)![0] + mini.trees.at(-1)![1];
      if (bandEnd !== MINIATURE_UNITS) violations.push(`seed ${seed}: bands end at ${bandEnd}`);
      if (mini.blocks.length > MAX_MINIATURE_BLOCKS) violations.push(`seed ${seed}: ${mini.blocks.length} blocks`);

      // The open block at each depth: a block's parent is the last block one depth up.
      const open: [number, number][] = [];
      const lastEnd = new Map<number, number>();
      mini.blocks.forEach(([depth, start, span], i) => {
        const where = `seed ${seed}, block ${i}`;
        if (span < MINIATURE_MIN_SPAN) violations.push(`${where}: span ${span}`);
        if (!Number.isInteger(start) || !Number.isInteger(span)) violations.push(`${where}: not whole units`);
        const parent =
          depth === 1
            ? mini.trees.find(([s, w]) => start >= s && start < s + w)
            : open[depth - 1];
        if (!parent || start < parent[0] || start + span > parent[0] + parent[1]) {
          violations.push(`${where}: outside its parent`);
        }
        if (start < (lastEnd.get(depth) ?? 0)) violations.push(`${where}: overlaps the block before it`);
        lastEnd.set(depth, start + span);
        open[depth] = [start, span];
        open.length = depth + 1;
      });
      if (mini.depth !== Math.max(0, ...mini.blocks.map((block) => block[0]))) {
        violations.push(`seed ${seed}: depth ${mini.depth}`);
      }
    }
    expectNoViolations(violations);
  });

  it("is byte-identical on identical input, whatever the stored order of moves", () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const trees = randomTrees(mulberry32(seed));
      const first = JSON.stringify(miniature(trees));
      if (JSON.stringify(miniature(trees)) !== first) violations.push(`seed ${seed}: differs on a rerun`);
      if (JSON.stringify(miniature(trees.map(reversed))) !== first) violations.push(`seed ${seed}: differs on order`);
    }
    expectNoViolations(violations);
  });

  it("keeps the shallowest of equally wide blocks when there are too many", () => {
    // 125 lines of four moves, each block 8 units wide: 500 blocks, all the same width.
    const chain = (id: string, depth: number): MoveNode => ({
      id,
      san: "a",
      uci: id.slice(-6),
      fen: START_FEN,
      children: depth < 4 ? [chain(`${id}:${depth}`, depth + 1)] : [],
    });
    const wide: MoveNode = {
      id: "root",
      san: null,
      uci: null,
      fen: START_FEN,
      children: Array.from({ length: 125 }, (_, i) => chain(`root:${String(i).padStart(3, "0")}`, 1)),
    };
    const mini = miniature([wide]);
    const atDepth = (d: number) => mini.blocks.filter(([depth]) => depth === d).length;
    expect(mini.blocks).toHaveLength(MAX_MINIATURE_BLOCKS);
    expect([1, 2, 3, 4].map(atDepth)).toEqual([125, 125, 125, 25]);
    expect(mini.depth).toBe(4);
  });
});
