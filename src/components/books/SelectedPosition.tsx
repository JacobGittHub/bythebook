"use client";

import type { ReactNode } from "react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import type { BookSide } from "@/lib/books/measures";
import { isClash, lineText, moveLabel, pathTo, type ViewNode } from "@/lib/books/viewTree";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { cn } from "@/lib/utils";

type Props = {
  /** The position to show: the hovered one, else the selected one. */
  node: ViewNode | null;
  /** True while `node` is only hovered. */
  preview: boolean;
  /** Whose book it is: the board's orientation and the clash note. */
  side: BookSide;
  /** Room for buttons under the position, such as Remove move. */
  children?: ReactNode;
  /** Sizes the board's box; `max-w-72` by default. */
  boardClassName?: string;
  className?: string;
};

/**
 * A book's selected (or hovered) position: its move and opening name, a board, the line to it,
 * and how much of the book lies after it. Every part keeps a fixed height, so moving the
 * pointer over the view never moves this panel's contents.
 */
export function SelectedPosition({ node, preview, side, children, boardClassName, className }: Props) {
  const openingName = node
    ? getOpeningForLine(
        pathTo(node)
          .slice(1)
          .map((n) => n.fen),
      )?.name
    : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {preview ? "Preview" : "Selected"}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {node ? moveLabel(node) : "…"}
          {openingName && <span className="font-normal text-muted-foreground"> · {openingName}</span>}
        </p>
      </div>
      <div className={cn("mx-auto w-full max-w-72", boardClassName)}>
        <BoardDisplay fen={node?.fen} size="md" orientation={side} animate={!preview} />
      </div>
      {/* A fixed height, so a long line scrolls instead of moving what is below it. */}
      <p className="h-10 overflow-y-auto font-mono text-xs leading-5 text-foreground">
        {node ? lineText(pathTo(node)) || "Starting position" : ""}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Positions after</dt>
        <dd className="tabular-nums">{node ? node.size - (node.depth > 0 ? 1 : 0) : "–"}</dd>
        <dt className="text-muted-foreground">Lines through</dt>
        <dd className="tabular-nums">{node ? node.leaves : "–"}</dd>
        <dt className="col-span-2 h-4 font-medium text-[var(--view-clash)]">
          {node && isClash(node, side)
            ? `${side === "white" ? "White" : "Black"} has ${node.children.length} book moves here.`
            : ""}
        </dt>
      </dl>
      {children}
    </div>
  );
}
