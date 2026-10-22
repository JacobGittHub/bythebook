"use client";

import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { Button } from "@/components/shadcn/button";
import { lineText, moveLabel, pathTo, type ViewNode } from "@/lib/books/viewTree";
import { scoreOf } from "@/lib/history/historyTree";
import type { Tally } from "@/lib/history/types";
import { explorerHref } from "@/lib/library/links";
import { cn } from "@/lib/utils";
import { ResultsBar } from "./GameHistorySection";

type Props = {
  node: ViewNode;
  /** The user's results from each position, by node id. */
  results: ReadonlyMap<string, Tally>;
  /** The move the arrow keys would play, marked in the list of moves played next. */
  highlightId: string | null;
  orientation: "white" | "black";
  onSelect: (node: ViewNode) => void;
};

const count = (n: number) => n.toLocaleString("en-US");
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);
const NONE: Tally = { win: 0, draw: 0, loss: 0 };

/**
 * The history page's current position (plans/game-history.md D30): the board, the move and the
 * line to it, the user's results from it, and the moves played next with theirs. The details keep
 * the board's height and the moves scroll inside them, so a position with many moves never moves
 * the tree below.
 */
export function HistoryPosition({ node, results, highlightId, orientation, onSelect }: Props) {
  const tally = results.get(node.id) ?? NONE;
  const path = pathTo(node);
  return (
    <div className="grid shrink-0 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="w-full max-w-72 md:max-w-none">
        <BoardDisplay fen={node.fen} size="md" orientation={orientation} />
      </div>
      <div className="flex min-w-0 flex-col gap-1 md:h-52">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="book-sc">{node.san ? "Current position" : "Starting position"}</p>
            <p className="truncate font-heading text-[22px] leading-tight font-semibold">{node.san ? moveLabel(node) : "Start"}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={explorerHref({ line: path })}>Open in Explorer</Link>
          </Button>
        </div>
        <p className="line-clamp-2 h-9 shrink-0 font-mono text-xs leading-[1.5] text-muted-foreground" title={lineText(path)}>
          {node.san ? lineText(path) : "Before the first move"}
        </p>
        <p className="text-xs">
          <b className="tabular-nums">{count(node.games ?? 0)}</b> games · <span className="tabular-nums">{tally.win} · {tally.draw} · {tally.loss}</span> ·
          score <b className="tabular-nums">{percent(scoreOf(tally))}</b>
        </p>
        <ResultsBar results={tally} />
        <p className="mt-1 book-sc">{node.children.length ? `Played next · ${node.children.length}` : "No games go further here"}</p>
        <div role="listbox" aria-label="Moves played next" className="flex min-h-0 flex-col gap-px overflow-y-auto border-t border-rule pt-0.5 [scrollbar-width:thin] max-md:max-h-40 md:flex-1">
          {node.children.map((child) => {
            const next = results.get(child.id) ?? NONE;
            return (
              <button
                key={child.id}
                type="button"
                role="option"
                aria-selected={child.id === highlightId}
                onClick={() => onSelect(child)}
                className={cn(
                  "grid grid-cols-[4rem_2.75rem_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-sm border border-transparent px-1 py-0.5 text-left text-xs hover:bg-accent",
                  child.id === highlightId && "border-primary",
                )}
              >
                <b className="font-mono font-medium">{moveLabel(child)}</b>
                <span className="text-muted-foreground tabular-nums">{count(child.games ?? 0)}</span>
                <ResultsBar results={next} className="h-1.5" />
                <span className="text-right tabular-nums">{percent(scoreOf(next))}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
