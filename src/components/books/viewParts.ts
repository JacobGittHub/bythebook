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
};

/** " on-path on-hover is-selected", as far as each applies. */
export function markClasses(marks: ViewMarks, id: string): string {
  return `${marks.onPath.has(id) ? " on-path" : ""}${marks.onHover.has(id) ? " on-hover" : ""}${
    marks.selectedId === id ? " is-selected" : ""
  }`;
}

/** The fill class for whose move a node is. */
export function moveClass(node: ViewNode): "root" | "wm" | "bm" {
  return node.depth === 0 ? "root" : isWhiteMove(node) ? "wm" : "bm";
}

export function clashClass(node: ViewNode, side: BookSide | null): string {
  return side && isClash(node, side) ? " clash" : "";
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
