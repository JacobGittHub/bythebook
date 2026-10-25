// What the five book view renderers share: how a node is marked as selected, hovered or on
// the selected line, and the pointer handlers every target gets. The marks are classes
// only (`.bv-*` in globals.css), so hovering restyles the view and never lays it out again.

import type { MouseEvent } from "react";
import type { BookSide } from "@/lib/books/measures";
import { isClash, isWhiteMove, type ViewNode, type ViewTree } from "@/lib/books/viewTree";

export type ViewMarks = {
  /** Ids on the path to the selected position. */
  onPath: ReadonlySet<string>;
  /** Ids on the path to the hovered position. */
  onHover: ReadonlySet<string>;
  selectedId: string;
  /** The selected position's moves, which walking with the arrow keys chooses among. */
  next: ReadonlySet<string>;
  /** The move the arrow keys would play (plans/game-history.md D32). */
  highlightId: string | null;
};

export type TargetHandlers = {
  className: string;
  /** The move, as "5.Bf5", so tests and tools can find a position's target. */
  "data-move": string;
  onMouseEnter: (event: MouseEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onMouseLeave: () => void;
  onClick: () => void;
};

/** The handlers that make an element a target for this node, with its own classes added. */
export type Bind = (node: ViewNode, className?: string) => TargetHandlers;

/** What every renderer receives besides its own layout. */
export type RenderProps = {
  tree: ViewTree;
  marks: ViewMarks;
  bind: Bind;
  /** Whose book it is, for the clash rings; null draws none. */
  side: BookSide | null;
  family: ReadonlyMap<string, number>;
  /** How heavy a move's edge is drawn, from 0 to 1. */
  weight: (node: ViewNode) => number;
  /** The user's score from each position, from 0 to 1, where the view paints success; null where no game went. */
  success?: ReadonlyMap<string, number | null>;
};

/** " on-path on-hover is-selected is-next is-highlighted", as far as each applies. */
export function markClasses(marks: ViewMarks, id: string): string {
  return `${marks.onPath.has(id) ? " on-path" : ""}${marks.onHover.has(id) ? " on-hover" : ""}${
    marks.selectedId === id ? " is-selected" : ""
  }${marks.next.has(id) ? " is-next" : ""}${marks.highlightId === id ? " is-highlighted" : ""}`;
}

/**
 * " out" for a move played past the end of the Explorer's chosen book, whose edge is dashed, and
 * " undrilled" for a move drills skip (plans/game-history.md D40), dashed and faded.
 */
export function outClass(node: ViewNode): string {
  return `${node.out ? " out" : ""}${node.undrilled ? " undrilled" : ""}`;
}

/** The fill class for whose move a node is. */
export function moveClass(node: ViewNode): "root" | "wm" | "bm" {
  return node.depth === 0 ? "root" : isWhiteMove(node) ? "wm" : "bm";
}

export function clashClass(node: ViewNode, side: BookSide | null): string {
  return side && isClash(node, side) ? " clash" : "";
}

/**
 * The color of a score (plans/game-history.md D35): red at 30% and below, through the draw's
 * grey at 50%, to green at 70% and above, mixed from the theme's colors so every vibe repaints it.
 */
export function successColor(score: number): string {
  const t = Math.min(1, Math.max(0, (score - 0.3) / 0.4));
  return t < 0.5
    ? `color-mix(in oklab, var(--bar-draw) ${Math.round(t * 200)}%, var(--destructive))`
    : `color-mix(in oklab, var(--success) ${Math.round((t - 0.5) * 200)}%, var(--bar-draw))`;
}

export function familyColor(family: number | undefined): string {
  return family === undefined || family < 0 ? "var(--view-trunk)" : `var(--fam-${family})`;
}

/** A line's ruler: a mark at each of White's moves, numbered. */
export function rulerColumns(maxDepth: number, rootPly: number): { depth: number; number: number }[] {
  const columns: { depth: number; number: number }[] = [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const ply = rootPly + depth;
    if (ply % 2 === 1) columns.push({ depth, number: (ply + 1) / 2 });
  }
  return columns;
}
