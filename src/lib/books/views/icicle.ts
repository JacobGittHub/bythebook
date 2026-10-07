// D. Icicle: each move as a block in its ply's column, its height its share of the block
// before it: the Labyrinth's regions, laid flat. Children split their parent's height, so
// every block lies inside its parent's rows and siblings never overlap.

import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { columnWidth, type Box } from "./common";

export const ICICLE_PAD = { left: 12, right: 12, top: 24, bottom: 10 };
const COL_W = { min: 30, max: 96 };

/** What a block's height stands for: the lines behind it, or the master games that played it. */
export type IcicleWeight = "lines" | "games";

export type IcicleCell = { x: number; y: number; width: number; height: number };

export type IcicleLayout = {
  width: number;
  height: number;
  colW: number;
  /** Every node but the root, which is the whole column before the first. */
  cells: Map<string, IcicleCell>;
};

/** The gap between blocks, in pixels. */
export const ICICLE_GAP = 1.2;

export function icicleLayout(tree: ViewTree, box: Box, weight: IcicleWeight = "lines"): IcicleLayout {
  const pad = ICICLE_PAD;
  const colW = columnWidth(box.width - pad.left - pad.right, tree.maxDepth, COL_W.min, COL_W.max);
  const cells = new Map<string, IcicleCell>();

  const weightOf = (node: ViewNode, siblings: readonly ViewNode[]) =>
    weight === "games" && siblings.every((sibling) => (sibling.games ?? 0) > 0)
      ? node.games!
      : node.leaves;

  const split = (node: ViewNode, y: number, height: number) => {
    const total = node.children.reduce((sum, child) => sum + weightOf(child, node.children), 0);
    let top = y;
    for (const child of node.children) {
      const share = (height * weightOf(child, node.children)) / total;
      cells.set(child.id, {
        x: pad.left + (child.depth - 1) * colW,
        y: top,
        width: colW,
        height: share,
      });
      split(child, top, share);
      top += share;
    }
  };
  split(tree.root, pad.top, box.height - pad.top - pad.bottom);

  return {
    width: Math.max(box.width, pad.left + tree.maxDepth * colW + pad.right),
    height: box.height,
    colW,
    cells,
  };
}
