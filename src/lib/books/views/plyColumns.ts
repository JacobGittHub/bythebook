// A. Ply columns: a tidy tree with one column per ply, so depth lines up across branches.
// Each line ends in its own row; a position sits midway between its first and last move.

import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { clamp, columnWidth, type Box, type Point } from "./common";

export const PLY_COLUMNS_PAD = { left: 18, right: 40, top: 26, bottom: 16 };
const COL_W = { min: 26, max: 72 };
const ROW_H = { min: 9, max: 28 };

export type PlyColumnsLayout = {
  width: number;
  height: number;
  colW: number;
  rowH: number;
  points: Map<string, Point>;
};

export function plyColumnsLayout(tree: ViewTree, box: Box): PlyColumnsLayout {
  const pad = PLY_COLUMNS_PAD;
  const colW = columnWidth(box.width - pad.left - pad.right, tree.maxDepth, COL_W.min, COL_W.max);
  const rows = tree.root.leaves;
  const available = box.height - pad.top - pad.bottom;
  const rowH = clamp(available / Math.max(rows - 1, 1), ROW_H.min, ROW_H.max);
  const used = rowH * (rows - 1);
  // A small tree is centred in the box; a tall one starts at the top and the box scrolls.
  const top = pad.top + Math.max(0, (available - used) / 2);
  const points = new Map<string, Point>();
  let row = 0;

  const place = (node: ViewNode) => {
    const x = pad.left + node.depth * colW;
    if (!node.children.length) {
      points.set(node.id, { x, y: top + row++ * rowH });
      return;
    }
    node.children.forEach(place);
    const first = points.get(node.children[0].id)!.y;
    const last = points.get(node.children[node.children.length - 1].id)!.y;
    points.set(node.id, { x, y: (first + last) / 2 });
  };
  place(tree.root);

  return {
    width: Math.max(box.width, pad.left + tree.maxDepth * colW + pad.right),
    height: Math.max(box.height, top + used + pad.bottom),
    colW,
    rowH,
    points,
  };
}
