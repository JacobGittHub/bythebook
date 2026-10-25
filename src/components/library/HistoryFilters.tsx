"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import {
  ALL_GAMES,
  RECENT_MONTHS,
  dateSummary,
  groupState,
  isAllGames,
  monthName,
  monthStrip,
  sourceGroups,
  sourceSummary,
  timeGroups,
  timeSummary,
  withKeys,
  type HistoryFilter,
  type HistoryGame,
  type OptionGroup,
} from "@/lib/history/historyFilter";
import type { HistoryImport } from "@/lib/history/types";
import { cn } from "@/lib/utils";

type Props = {
  games: readonly HistoryGame[];
  imports: readonly HistoryImport[];
  filter: HistoryFilter;
  onChange: (filter: HistoryFilter) => void;
  className?: string;
};

const count = (n: number) => n.toLocaleString("en-US");

/**
 * Which games the history page shows (plans/game-history.md D38): a button for the time controls
 * and one for the sources, each saying what is chosen and opening its check boxes, "All games" to
 * put everything back, and a strip of games per month to drag a span across. The side is the
 * page's toggle beside its title.
 */
export function HistoryFilters({ games, imports, filter, onChange, className }: Props) {
  const time = useMemo(() => timeGroups(games, filter), [games, filter]);
  const sources = useMemo(() => sourceGroups(games, imports, filter), [games, imports, filter]);
  return (
    <div role="group" aria-label="Which games" className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChoicePanel
          name="Time"
          summary={timeSummary(time, filter.offTimes)}
          groups={time}
          off={filter.offTimes}
          onChange={(offTimes) => onChange({ ...filter, offTimes })}
        />
        <ChoicePanel
          name="From"
          summary={sourceSummary(sources, filter.offSources)}
          groups={sources}
          off={filter.offSources}
          onChange={(offSources) => onChange({ ...filter, offSources })}
        />
        {!isAllGames(filter) && (
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => onChange(ALL_GAMES)}>
            All games
          </Button>
        )}
      </div>
      <MonthStrip games={games} filter={filter} onChange={onChange} />
    </div>
  );
}

/** A button that says what a choice holds and opens its check boxes, each group with its options nested. */
function ChoicePanel({
  name,
  summary,
  groups,
  off,
  onChange,
}: {
  name: string;
  summary: string;
  groups: readonly OptionGroup[];
  off: ReadonlySet<string>;
  onChange: (off: ReadonlySet<string>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("max-w-full font-normal", off.size > 0 && "border-primary")}>
          <span className="text-muted-foreground">{name}</span>
          <span className="truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-80 w-72 flex-col gap-px overflow-y-auto p-1.5 [scrollbar-width:thin]">
        <ChoiceGroups label={name === "Time" ? "Time controls" : "Sources and imports"} groups={groups} off={off} onChange={onChange} />
        <div className="mt-1 flex justify-between border-t border-rule px-1 pt-1.5">
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => onChange(new Set())}>
            All
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

/** Check boxes for groups of options, each group's box ticking or clearing all of its options. */
export function ChoiceGroups({
  label,
  groups,
  off,
  onChange,
}: {
  label: string;
  groups: readonly OptionGroup[];
  off: ReadonlySet<string>;
  onChange: (off: ReadonlySet<string>) => void;
}) {
  const keys = (group: OptionGroup) => group.options.map((option) => option.key);
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-px">
      {groups.map((group) => {
        const state = groupState(group, off);
        return (
          <div key={group.label} className="flex flex-col gap-px">
            <Choice
              label={group.label}
              games={group.games}
              checked={state === "all" ? true : state === "some" ? "indeterminate" : false}
              onChange={(on) => onChange(withKeys(off, keys(group), on))}
            />
            {group.options.map((option) => (
              <Choice
                key={option.key}
                label={option.label}
                note={option.note}
                games={option.games}
                checked={!off.has(option.key)}
                onChange={(on) => onChange(withKeys(off, [option.key], on))}
                nested
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Choice({
  label,
  note,
  games,
  checked,
  onChange,
  nested = false,
}: {
  label: string;
  note?: string;
  games: number;
  checked: boolean | "indeterminate";
  onChange: (on: boolean) => void;
  nested?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-1.5 py-1 text-[13px] hover:bg-accent",
        nested && "pl-7 text-xs",
        games === 0 && "text-muted-foreground",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count(games)}</span>
      {note && <span className="col-start-2 col-end-4 truncate text-[11px] text-muted-foreground">{note}</span>}
    </label>
  );
}

const STRIP_W = 1000;
const STRIP_H = 34;

/** Games per month across the page; dragging across it chooses a span, which applies when the drag ends. */
function MonthStrip({ games, filter, onChange }: { games: readonly HistoryGame[]; filter: HistoryFilter; onChange: (filter: HistoryFilter) => void }) {
  const strip = useMemo(() => monthStrip(games, filter), [games, filter]);
  const [drag, setDrag] = useState<{ anchor: number; from: number; to: number } | null>(null);
  const { months } = strip;
  if (!months.length) return null;
  const last = months.length - 1;
  const index = (month: string | null, fallback: number) => (month ? Math.max(0, months.indexOf(month)) : fallback);
  const span = drag ?? { from: filter.from ? index(filter.from, 0) : 0, to: filter.to ? index(filter.to, last) : last };
  const max = Math.max(1, ...strip.games);
  const bar = STRIP_W / months.length;

  const choose = (from: number, to: number) =>
    onChange({ ...filter, from: from <= 0 ? null : months[from], to: to >= last ? null : months[to] });
  const monthAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(last, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * months.length)));
  };
  const preset = (label: string, from: number) => {
    const start = Math.max(0, from);
    const pressed = span.from === start && span.to === last;
    return (
      <Button variant="ghost" size="xs" aria-pressed={pressed} className={cn("h-6 px-1.5 font-normal text-muted-foreground", pressed && "font-bold text-foreground")} onClick={() => choose(start, last)}>
        {label}
      </Button>
    );
  };

  return (
    <div role="group" aria-label="Dates" className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2.5 text-xs">
        <b className="font-semibold">{drag ? dateSummary({ ...filter, from: months[drag.from], to: months[drag.to] }) : dateSummary(filter)}</b>
        <span className="grow" />
        {preset("3 months", last - 2)}
        {preset("Year", last - (RECENT_MONTHS - 1))}
        {preset("All", 0)}
      </div>
      <div className="relative h-[34px]">
        <svg
          viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 block h-6 w-full cursor-ew-resize touch-none"
          role="img"
          aria-label={`Games per month, ${monthName(months[0])} to ${monthName(months[last])}; drag across to choose a span`}
          onPointerDown={(event) => {
            const at = monthAt(event);
            event.currentTarget.setPointerCapture(event.pointerId);
            setDrag({ anchor: at, from: at, to: at });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            const at = monthAt(event);
            setDrag({ anchor: drag.anchor, from: Math.min(drag.anchor, at), to: Math.max(drag.anchor, at) });
          }}
          onPointerUp={() => {
            if (!drag) return;
            setDrag(null);
            choose(drag.from, drag.to);
          }}
        >
          {strip.games.map((n, i) => {
            const height = n ? 3 + (STRIP_H - 3) * Math.sqrt(n / max) : 0;
            return (
              <rect
                key={months[i]}
                x={i * bar + 1}
                y={STRIP_H - height}
                width={Math.max(bar - 2, 0.5)}
                height={height}
                className={i >= span.from && i <= span.to ? "fill-primary opacity-70" : "fill-border"}
              >
                <title>{`${monthName(months[i])} · ${count(n)} games`}</title>
              </rect>
            );
          })}
          {[span.from * bar, (span.to + 1) * bar].map((x, i) => (
            <line key={i} x1={x} x2={x} y1={0} y2={STRIP_H} className="stroke-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* Years are written under the strip in HTML, since the strip's drawing stretches to its width. */}
        {months.map((month, i) =>
          month.endsWith("-01") || i === 0 ? (
            <span
              key={month}
              className="absolute bottom-0 text-[9px] leading-none text-muted-foreground"
              style={{ left: `${(i / months.length) * 100}%` }}
            >
              {month.slice(0, 4)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
