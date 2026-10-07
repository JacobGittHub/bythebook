// A book's icicle in miniature, for the book list's rows and the store's cards
// (plans/deployment.md D21, D26). It is the icicle view's split (`views/icicle.ts`, by lines)
// kept down to blocks of a minimum share, in whole units, so it is small enough to store in a
// book's summary and draws the same at any size. Pure: every block lies inside its parent's
// span, siblings never overlap, and the output is byte-identical on identical input.

import { buildViewTree, families, plyOfFen, type ViewNode } from "@/lib/books/viewTree";
import type { MoveNode } from "@/types/chess";
import type { Miniature } from "./types";

/** The height of the whole book, in units. */
export const MINIATURE_UNITS = 1_000;

/** The smallest block kept, in units: a quarter pixel in a 38px list row, the mockup's cutoff. */
export const MINIATURE_MIN_SPAN = 7;

/** The most blocks a miniature keeps, which bounds a summary's size. */
export const MAX_MINIATURE_BLOCKS = 400;

/**
 * Splits `total` whole units by `weights`, giving the leftover units to the largest
 * remainders, earlier first on a tie, so the parts always add up to `total`.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - parts[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left-- <= 0) break;
    parts[index]++;
  }
  return parts;
}

type Block = Miniature["blocks"][number];

export function miniature(trees: readonly MoveNode[]): Miniature {
  const views = trees.map((tree) => buildViewTree(tree));
  const bands = apportion(
    MINIATURE_UNITS,
    views.map((view) => view.root.leaves),
  );

  const blocks: Block[] = [];
  const treeBands: Miniature["trees"] = [];
  let start = 0;
  views.forEach((view, t) => {
    const family = families(view);
    const split = (node: ViewNode, from: number, span: number) => {
      const spans = apportion(
        span,
        node.children.map((child) => child.leaves),
      );
      let top = from;
      node.children.forEach((child, i) => {
        // A child is never wider than its parent, so nothing below a dropped block is kept.
        if (spans[i] >= MINIATURE_MIN_SPAN) {
          blocks.push([child.depth, top, spans[i], family.get(child.id) ?? -1]);
          split(child, top, spans[i]);
        }
        top += spans[i];
      });
    };
    treeBands.push([start, bands[t], plyOfFen(trees[t].fen)]);
    split(view.root, start, bands[t]);
    start += bands[t];
  });

  // Too many blocks: keep the widest, the shallower first on a tie, then the earlier. A parent
  // is at least as wide as its child and shallower, so it always ranks ahead of it, and every
  // kept block keeps its parent.
  let kept = blocks;
  if (blocks.length > MAX_MINIATURE_BLOCKS) {
    const ranked = blocks
      .map((block, index) => index)
      .sort((a, b) => blocks[b][2] - blocks[a][2] || blocks[a][0] - blocks[b][0] || a - b);
    const keep = new Set(ranked.slice(0, MAX_MINIATURE_BLOCKS));
    kept = blocks.filter((_, index) => keep.has(index));
  }

  return {
    units: MINIATURE_UNITS,
    depth: kept.reduce((deepest, block) => Math.max(deepest, block[0]), 0),
    trees: treeBands,
    blocks: kept,
  };
}
