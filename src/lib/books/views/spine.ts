// E. Spine and ribs: one line straight across, with the other moves at each of its positions
// as ribs above and below, sized by what is behind them. The spine is chosen by clicking,
// never by hovering: in the first mockup a hover re-laid the view, which moved the rib out
// from under the pointer and back again in a loop.

import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { pathTo } from "@/lib/books/viewTree";
import { LABEL_CHAR_W, clamp, type Box } from "./common";

export const SPINE_PAD = { left: 24, right: 72, top: 14, bottom: 14 };
const STEP = { min: 34, max: 52 };
/** How far the first level of ribs sits from the spine, and the space between levels. */
export const RIB_OFFSET = 30;
export const RIB_LEVEL = 17;
/** Clear space kept between two rib labels on one level. */
const RIB_LABEL_GAP = 4;

/** What a rib's size and label count: the positions behind it, or its share of master games. */
export type SpineWeight = "positions" | "games";

export type SpineRib = {
  node: ViewNode;
  /** The spine position it branches from. */
  from: ViewNode;
  x: number;
  y: number;
  r: number;
  /** -1 above the spine, 1 below. */
  side: -1 | 1;
  level: number;
  label: string;
  /** The horizontal extent its dot and label take on its level. */
  extent: [number, number];
};

export type SpineLayout = {
  width: number;
  height: number;
  step: number;
  /** The spine's y. */
  midY: number;
  spine: { node: ViewNode; x: number }[];
  ribs: SpineRib[];
};

/** The rib's label: its move, then the positions behind it or its share of the games. */
export function ribLabel(node: ViewNode, weight: SpineWeight): string {
  if (weight === "games" && node.parent && node.games !== null) {
    const total = node.parent.children.reduce((sum, child) => sum + (child.games ?? 0), 0);
    if (total > 0) return `${node.san} ${Math.round((node.games / total) * 100)}%`;
  }
  return `${node.san} ${node.size}`;
}

function ribRadius(node: ViewNode, tree: ViewTree, weight: SpineWeight): number {
  if (weight === "games" && node.parent && node.games !== null) {
    const total = node.parent.children.reduce((sum, child) => sum + (child.games ?? 0), 0);
    if (total > 0) return clamp(2.2 + 6 * Math.sqrt(node.games / total), 2.2, 7);
  }
  return clamp(2.2 + 9 * Math.sqrt(node.size / Math.max(tree.root.size, 1)), 2.2, 7);
}

/**
 * @param spineEnd the last position of the spine; the spine is the path to it
 */
export function spineLayout(
  tree: ViewTree,
  box: Box,
  spineEnd: ViewNode,
  weight: SpineWeight = "positions",
): SpineLayout {
  const pad = SPINE_PAD;
  const path = pathTo(spineEnd);
  const step = clamp(
    (box.width - pad.left - pad.right) / Math.max(path.length - 1, 1),
    STEP.min,
    STEP.max,
  );
  const xOf = (i: number) => pad.left + i * step;

  // Each rib takes the nearest level, above or below, where its dot and label fit beside the
  // ribs already there. Ribs are placed spine position by spine position, heaviest first.
  const levels: Record<-1 | 1, [number, number][][]> = { [-1]: [], [1]: [] };
  const freeLevel = (side: -1 | 1, [a, b]: [number, number]) => {
    for (let level = 0; ; level++) {
      const used = levels[side][level] ?? [];
      if (!used.some(([x, y]) => a < y + RIB_LABEL_GAP && x < b + RIB_LABEL_GAP)) return level;
    }
  };
  const placed: Omit<SpineRib, "y">[] = [];
  for (let i = 0; i < path.length; i++) {
    const next = path[i + 1];
    const alternatives = path[i].children.filter((child) => child !== next);
    alternatives.forEach((node, k) => {
      const x = xOf(i + 1);
      const r = ribRadius(node, tree, weight);
      const label = ribLabel(node, weight);
      const extent: [number, number] = [x - r, x + r + 3 + label.length * LABEL_CHAR_W];
      const up = freeLevel(-1, extent);
      const down = freeLevel(1, extent);
      const side: -1 | 1 = up === down ? (k % 2 === 0 ? -1 : 1) : up < down ? -1 : 1;
      const level = side === -1 ? up : down;
      (levels[side][level] ??= []).push(extent);
      placed.push({ node, from: path[i], x, r, side, level, label, extent });
    });
  }

  const reach = (side: -1 | 1) =>
    levels[side].length ? RIB_OFFSET + (levels[side].length - 1) * RIB_LEVEL + 10 : 22;
  const above = reach(-1);
  const below = reach(1);
  // The spine sits in the middle of the box when the ribs fit, and the box grows when not.
  const height = Math.max(box.height, pad.top + above + below + pad.bottom);
  const midY = clamp(height / 2, pad.top + above, height - pad.bottom - below);
  const ribs = placed.map((rib) => ({
    ...rib,
    y: midY + rib.side * (RIB_OFFSET + rib.level * RIB_LEVEL),
  }));
  const right = Math.max(xOf(path.length - 1), ...ribs.map((rib) => rib.extent[1]));

  return {
    width: Math.max(box.width, right + pad.right),
    height,
    step,
    midY,
    spine: path.map((node, i) => ({ node, x: xOf(i) })),
    ribs,
  };
}
