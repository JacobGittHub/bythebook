"use client";

import { useMemo } from "react";
import { Button } from "@/components/shadcn/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { BookSide } from "@/lib/books/measures";
import { sourceGroups, timeGroups, type HistoryFilter, type HistoryGame } from "@/lib/history/historyFilter";
import type { HistoryImport } from "@/lib/history/types";
import { ChoiceGroups } from "./HistoryFilters";

/** The spans a book's page picks among, in months; "all" for every game. */
export const BOOK_SPANS = [
  [3, "3 months"],
  [12, "12 months"],
  ["all", "All time"],
] as const;
export type BookSpan = (typeof BOOK_SPANS)[number][0];

type Props = {
  games: readonly HistoryGame[];
  imports: readonly HistoryImport[];
  side: BookSide;
  /** The filter the span and the check boxes make, for the panels' counts. */
  filter: HistoryFilter;
  span: BookSpan;
  /** Games the filter chooses. */
  chosen: number;
  onSpan: (span: BookSpan) => void;
  onChange: (filter: Pick<HistoryFilter, "offTimes" | "offSources">) => void;
};

const count = (n: number) => n.toLocaleString("en-US");

/**
 * Which of the user's games a book's page compares with it (plans/game-history.md D38, D40): a
 * button saying what is chosen, with no dropdown arrow, opening the span (3 months, 12 months or
 * all time) and the history page's time and source check boxes. The side is the book's.
 */
export function BookGamesFilter({ games, imports, side, filter, span, chosen, onSpan, onChange }: Props) {
  const time = useMemo(() => timeGroups(games, filter), [games, filter]);
  const sources = useMemo(() => sourceGroups(games, imports, filter), [games, imports, filter]);
  const as = side === "white" ? "White" : "Black";
  const narrowed = filter.offTimes.size > 0 || filter.offSources.size > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-full font-normal">
          <span className="text-muted-foreground">Games</span>
          <span className="truncate">
            {span === "all" ? `All ${count(chosen)}` : `Last ${span} months · ${count(chosen)}`} as {as}
            {narrowed ? " · some" : ""}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-96 w-72 flex-col gap-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
        <p className="px-1.5 pt-1 book-sc">Dates</p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={String(span)}
          onValueChange={(next) => next && onSpan(next === "all" ? "all" : (Number(next) as BookSpan))}
          aria-label="Time span"
          className="mx-1.5 mb-1"
        >
          {BOOK_SPANS.map(([value, label]) => (
            <ToggleGroupItem key={value} value={String(value)} className="px-2.5">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="px-1.5 pt-1 book-sc">Time</p>
        <ChoiceGroups label="Time controls" groups={time} off={filter.offTimes} onChange={(offTimes) => onChange({ offTimes, offSources: filter.offSources })} />
        <p className="px-1.5 pt-1 book-sc">From</p>
        <ChoiceGroups label="Sources and imports" groups={sources} off={filter.offSources} onChange={(offSources) => onChange({ offTimes: filter.offTimes, offSources })} />
        <div className="mt-1 flex justify-between border-t border-rule px-1 pt-1.5">
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => {
              onSpan("all");
              onChange({ offTimes: new Set(), offSources: new Set() });
            }}
          >
            All games
          </Button>
          <PopoverClose asChild>
            <Button variant="link" size="xs" className="h-auto p-0">
              Done
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
