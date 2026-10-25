"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { MAX_BOOK_POSITIONS, MAX_DIFFICULTY } from "@/lib/books/measures";
import type { BookSummary } from "@/lib/library/types";
import { cn } from "@/lib/utils";

const count = (n: number) => n.toLocaleString("en-US");
/** The token for a difficulty's whole point (plans/bookstore.md D17). */
const difficultyColor = (d: number) => `var(--difficulty-${Math.min(MAX_DIFFICULTY - 1, Math.floor(d))})`;

type Props = {
  summary: BookSummary;
  /** The measured difficulty (`measuredDifficulty`); null for a book without moves. */
  difficulty: number | null;
  /** The book's own moves (`countOwnMoves`). */
  ownMoves: number;
  /** Clashes still to resolve (`openClashes`). */
  toResolve: number;
  onClashes: () => void;
  className?: string;
};

/**
 * A book's facts on its own page (plans/game-history.md D40): the difficulty scale, whose numbers
 * show on hover, beside the moves to remember and the average line it is measured from; then the
 * positions, the lines and the clashes, which open their dialog and are flagged while any is left
 * to resolve.
 */
export function BookFacts({ summary, difficulty, ownMoves, toResolve, onClashes, className }: Props) {
  return (
    <dl className={cn("flex shrink-0 flex-wrap gap-x-6 gap-y-1.5 border-y border-rule py-2.5", className)}>
      <div className="flex basis-full flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
        <dt className="sr-only">Difficulty</dt>
        <dd className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <DifficultyScale difficulty={difficulty} ownMoves={ownMoves} averageLine={summary.averageDepth} />
          <span>
            <b className="tabular-nums">{count(ownMoves)}</b> moves to remember
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            average line <b className="tabular-nums">{summary.averageDepth === null ? "–" : summary.averageDepth.toFixed(1)}</b> plies
          </span>
        </dd>
      </div>
      <Fact label="Positions">
        {count(summary.positions)} <span className="text-xs font-normal text-muted-foreground">/ {count(MAX_BOOK_POSITIONS)}</span>
      </Fact>
      <Fact label="Lines">
        {count(summary.lines)} <span className="text-xs font-normal text-muted-foreground">· longest {summary.maxDepth}</span>
      </Fact>
      <Fact label="Clashes">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onClashes}
          disabled={summary.clashes === 0}
          className={cn(
            "mt-px inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-sm font-medium tabular-nums hover:bg-accent disabled:pointer-events-none",
            toResolve > 0 && "border-[var(--view-clash)]",
          )}
        >
          {count(summary.clashes)}
          {summary.clashes > 0 &&
            (toResolve > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-warning/10 px-1.5 py-px text-[11.5px] font-semibold text-warning">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--view-clash)]" />
                {count(toResolve)} to resolve
              </span>
            ) : (
              <span className="text-[11.5px] font-medium text-success">All resolved</span>
            ))}
        </button>
      </Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * The difficulty as a dot on a scale of five colored steps (plans/bookstore.md D17); hovering or
 * focusing it shows the number and what it is measured from. A publisher's own rating, a larger
 * dot, joins it once store books carry one.
 */
function DifficultyScale({ difficulty, ownMoves, averageLine }: { difficulty: number | null; ownMoves: number; averageLine: number | null }) {
  if (difficulty === null) return <span className="text-muted-foreground">No difficulty yet</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={`Difficulty ${difficulty.toFixed(1)} of ${MAX_DIFFICULTY}, measured from the book`}
          className="mx-1 inline-flex cursor-help rounded-sm py-[5px]"
        >
          <span className="relative grid h-1.5 grid-cols-[repeat(5,22px)] gap-px">
            {Array.from({ length: MAX_DIFFICULTY }, (_, i) => (
              <i key={i} className="rounded-[1px] opacity-85" style={{ background: `var(--difficulty-${i})` }} />
            ))}
            <b
              className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
              style={{ left: `${(difficulty / MAX_DIFFICULTY) * 100}%`, background: difficultyColor(difficulty) }}
            />
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="grid max-w-64 gap-1.5 text-xs">
        <span className="flex items-baseline gap-2">
          <b className="text-sm tabular-nums">{difficulty.toFixed(1)}</b>
          <span>
            Measured from its {count(ownMoves)} moves to remember and {averageLine?.toFixed(1)}-ply lines
          </span>
        </span>
        <span className="flex justify-between border-t border-current/20 pt-1 opacity-80">
          <span>0 · easy</span>
          <span>{MAX_DIFFICULTY} · hard</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
