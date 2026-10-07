// B. Branch points: only the positions where the tree splits. A run of single moves becomes
// one stretch ending at the next split, and branches with few positions fold into "+n"
// unless the selected line runs through them.

import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { clamp, columnWidth, type Box } from "./common";

export const BRANCH_POINTS_PAD = { left: 18, right: 44, top: 26, bottom: 18 };
const COL_W = { min: 24, max: 72 };
const ROW_H = { min: 14, max: 24 };

/** Branches with fewer positions than this fold away, unless they must stay open. */
export const BRANCH_FOLD_BELOW = 4;

export type BranchSegment = {
  /** The stretch's moves, the first one's parent excluded. The root's stretch starts at it. */
  run: ViewNode[];
  /** The last position of the stretch, where it splits or ends; clicking the stretch selects it. */
  end: ViewNode;
  /** Where the stretch is drawn to, at its end's column. */
  x: number;
  y: number;
  /** The end of the stretch this one branches from; the root's stretch starts at its own row. */
  fromX: number;
  fromY: number;
  /** Positions folded away below `end`. */
  folded: number;
  /** The stretches below this one. */
  children: BranchSegment[];
};

export type BranchPointsLayout = {
  width: number;
  height: number;
  colW: number;
  segments: BranchSegment[];
};

/**
 * @param keep ids of positions that must stay visible, such as the selected line
 */
export function branchPointsLayout(
  tree: ViewTree,
  box: Box,
  keep: ReadonlySet<string> = new Set(),
): BranchPointsLayout {
  const pad = BRANCH_POINTS_PAD;
  const colW = columnWidth(box.width - pad.left - pad.right, tree.maxDepth, COL_W.min, COL_W.max);

  const segment = (start: ViewNode): BranchSegment => {
    const run = [start];
    let end = start;
    while (end.children.length === 1) {
      end = end.children[0];
      run.push(end);
    }
    const s: BranchSegment = { run, end, x: 0, y: 0, fromX: 0, fromY: 0, folded: 0, children: [] };
    for (const child of end.children) {
      if (child.size < BRANCH_FOLD_BELOW && !keep.has(child.id)) s.folded += child.size;
      else s.children.push(segment(child));
    }
    return s;
  };
  const top = segment(tree.root);

  const segments: BranchSegment[] = [];
  let rows = 0;
  const count = (s: BranchSegment) => {
    segments.push(s);
    if (!s.children.length) rows++;
    s.children.forEach(count);
  };
  count(top);

  const available = box.height - pad.top - pad.bottom;
  const rowH = clamp(available / Math.max(rows - 1, 1), ROW_H.min, ROW_H.max);
  const used = rowH * (rows - 1);
  const firstRow = pad.top + Math.max(0, (available - used) / 2);
  let row = 0;
  const place = (s: BranchSegment, from: BranchSegment | null) => {
    s.x = pad.left + s.end.depth * colW;
    s.children.forEach((child) => place(child, s));
    s.y = s.children.length
      ? (s.children[0].y + s.children[s.children.length - 1].y) / 2
      : firstRow + row++ * rowH;
    s.fromX = from ? from.x : pad.left;
    s.fromY = from ? from.y : s.y;
  };
  place(top, null);
  // A child's start was read before its parent's row was known; set it now.
  for (const s of segments) for (const child of s.children) child.fromY = s.y;

  return {
    width: Math.max(box.width, pad.left + tree.maxDepth * colW + pad.right),
    height: Math.max(box.height, firstRow + used + pad.bottom),
    colW,
    segments,
  };
}
