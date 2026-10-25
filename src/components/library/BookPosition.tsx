"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { Button } from "@/components/shadcn/button";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ClashState } from "@/lib/books/drills";
import type { BookSide } from "@/lib/books/measures";
import { lineText, moveLabel, pathTo, type ViewNode } from "@/lib/books/viewTree";
import { getOpeningEndingAt, getOpeningForLine } from "@/lib/chess/openingCatalog";
import type { BookExit, PositionGames } from "@/lib/history/compareWithBook";
import { scoreOf } from "@/lib/history/historyTree";
import { explorerHref } from "@/lib/library/links";
import { cn } from "@/lib/utils";
import { ResultsBar } from "./GameHistorySection";

type Props = {
  /** The book, which the Explorer opens with the position. */
  bookId: string;
  node: ViewNode;
  side: BookSide;
  /** The user's games at each book position, in Your games; null in Plain. */
  totals: ReadonlyMap<string, PositionGames> | null;
  /** The places games left the book at this position. */
  exits: readonly BookExit[];
  /** The move the arrow keys would play, marked in the list. */
  highlightId: string | null;
  /** The move drawn as an arrow on the board. */
  arrow: ViewNode | null;
  /** This position's state as a clash, or null when it isn't one. */
  clash: ClashState | null;
  onClash: () => void;
  onSelect: (node: ViewNode) => void;
  onHover: (node: ViewNode | null) => void;
  /** Buttons for the position, such as Remove move. */
  actions?: ReactNode;
};

const count = (n: number) => n.toLocaleString("en-US");
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);
const NONE: PositionGames = { games: 0, win: 0, draw: 0, loss: 0 };

/**
 * The current position on a book's own page (plans/game-history.md D36, D40): the board, the move
 * and its opening, the line to it and, with the user's games, their results from it. Beside the
 * board, boxes of fixed height that scroll inside: the book's next moves, unticked ones tagged
 * "not drilled", and where the user's games left the book here. The board's side keeps its
 * height as the position changes.
 */
export function BookPosition({ bookId, node, side, totals, exits, highlightId, arrow, clash, onClash, onSelect, onHover, actions }: Props) {
  const path = pathTo(node);
  const opening = getOpeningForLine(path.slice(1).map((step) => step.fen))?.name;
  const arrowColor = useThemeColor("--board-arrow", "rgb(44 74 116 / 0.55)");
  const listRef = useRef<HTMLDivElement>(null);
  const here = totals?.get(node.id) ?? NONE;

  // Only the list scrolls, never the page around it.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !row) return;
    const box = list.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    if (at.top < box.top) list.scrollTop -= box.top - at.top;
    else if (at.bottom > box.bottom) list.scrollTop += at.bottom - box.bottom;
  }, [node.id, highlightId]);

  return (
    <div className="grid shrink-0 gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="w-full max-w-72 md:max-w-none">
        <BoardDisplay
          fen={node.fen}
          size="md"
          orientation={side}
          arrows={arrow?.uci ? [{ startSquare: arrow.uci.slice(0, 2), endSquare: arrow.uci.slice(2, 4), color: arrowColor }] : []}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 md:h-60">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="book-sc">{node.san ? "Current position" : "Starting position"}</p>
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-heading text-[22px] leading-tight font-semibold">{node.san ? moveLabel(node) : "Start"}</span>
              <span className="truncate font-heading text-sm text-muted-foreground italic" title={opening}>
                {opening}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <Button asChild size="sm" variant="outline">
              <Link href={explorerHref({ bookId, line: path })}>Open in Explorer</Link>
            </Button>
          </div>
        </div>
        <p className="truncate font-mono text-xs leading-[1.5] text-muted-foreground" title={lineText(path)}>
          {node.san ? lineText(path) : "Before the first move"}
        </p>
        {totals && (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs">
              {here.games ? (
                <>
                  <b className="tabular-nums">{count(here.games)}</b> of your games ·{" "}
                  <span className="tabular-nums">
                    {here.win} · {here.draw} · {here.loss}
                  </span>{" "}
                  · score <b className="tabular-nums">{percent(scoreOf(here))}</b>
                </>
              ) : (
                <span className="text-muted-foreground">None of your games reached it</span>
              )}
            </p>
            <ResultsBar results={here} />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex min-h-11 flex-1 basis-0 flex-col">
            <p className="flex items-baseline gap-2 book-sc">
              {node.children.length ? `Next in the book · ${node.children.length}` : "The line ends here"}
              <span className="grow" />
              {clash && clash !== "off" && (
                <Button variant="link" size="xs" className="h-auto p-0 font-sans text-xs tracking-normal normal-case" onClick={onClash}>
                  {clash === "open" ? "Clash · choose moves to drill" : "Clash · change the moves to drill"}
                </Button>
              )}
            </p>
            <div
              ref={listRef}
              role="listbox"
              aria-label="Next in the book"
              onMouseLeave={() => onHover(null)}
              className="flex min-h-0 flex-col gap-px overflow-y-auto border-t border-rule pt-0.5 [scrollbar-width:thin] max-md:max-h-40 md:flex-1"
            >
              {node.children.map((child) => {
                const next = totals?.get(child.id) ?? NONE;
                const named = getOpeningEndingAt(child.fen)?.name;
                return (
                  <button
                    key={child.id}
                    type="button"
                    role="option"
                    aria-selected={child.id === highlightId}
                    onClick={() => onSelect(child)}
                    onMouseEnter={() => onHover(child)}
                    className={cn(
                      "grid items-center gap-2 rounded-sm border border-transparent px-1 py-0.5 text-left text-xs hover:bg-accent",
                      totals ? "grid-cols-[4rem_minmax(0,1fr)_2.75rem_4.5rem_2.5rem]" : "grid-cols-[4rem_minmax(0,1fr)_auto]",
                      child.id === highlightId && "border-primary",
                    )}
                  >
                    <b className="font-mono font-medium">{moveLabel(child)}</b>
                    <span className="truncate font-heading text-muted-foreground italic" title={named}>
                      {child.undrilled && !node.undrilled && (
                        <span className="mr-1.5 rounded-sm border border-dashed px-1 font-sans text-[10.5px] not-italic">not drilled</span>
                      )}
                      {named !== opening ? named : null}
                    </span>
                    {totals ? (
                      <>
                        <span className="text-muted-foreground tabular-nums">{count(next.games)}</span>
                        <ResultsBar results={next} className="h-1.5" />
                        <span className="text-right tabular-nums">{percent(scoreOf(next))}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground tabular-nums">
                        {child.leaves} {child.leaves === 1 ? "line" : "lines"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {totals && (
            <div className="flex min-h-11 flex-1 basis-0 flex-col">
              <p className="book-sc">Left the book here · {exits.length}</p>
              <div className="flex min-h-0 flex-col gap-px overflow-y-auto border-t border-rule pt-0.5 [scrollbar-width:thin] max-md:max-h-32 md:flex-1">
                {exits.length ? (
                  exits.map((exit) => (
                    <div key={exit.uci} className="grid grid-cols-[4rem_4.5rem_2.75rem_4.5rem_2.5rem] items-center gap-2 px-1 py-0.5 text-xs">
                      <b className="font-mono font-medium">{exit.san ? exitLabel(exit) : exit.uci}</b>
                      <WhoTag by={exit.by} />
                      <span className="text-muted-foreground tabular-nums">{count(exit.games)}</span>
                      <ResultsBar results={exit.tally} className="h-1.5" />
                      <span className="text-right tabular-nums">{percent(scoreOf(exit.tally))}</span>
                    </div>
                  ))
                ) : (
                  <p className="px-1 py-0.5 text-xs text-muted-foreground">None of your games left the book here.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "4.Nf3" or "4...Nc6": a move played at an exit's position. */
export function exitLabel(exit: BookExit): string {
  const ply = exit.from.ply + 1;
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}.${exit.san}` : `${number}...${exit.san}`;
}

/** Who left the book: You, or Opponent. */
export function WhoTag({ by }: { by: BookExit["by"] }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1 py-px text-center font-heading text-[9px] font-semibold tracking-[0.12em] uppercase",
        by === "you" ? "border-primary text-primary" : "text-muted-foreground",
      )}
    >
      {by === "you" ? "You" : "Opponent"}
    </span>
  );
}
