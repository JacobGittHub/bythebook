"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, MoveUpRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Toggle } from "@/components/shadcn/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { EngineLine, EngineMode } from "@/hooks/useEngine";
import { searchCatalogMatches } from "@/lib/chess/openingCatalog";
import { evalToBarPct, formatScore } from "@/lib/chess/stockfishUci";
import { cn } from "@/lib/utils";
import type { CatalogMatch, ExplorerMove } from "@/types/chess";

// The Explorer's parts on the book's pages (plans/book-ui.md D6): the slots of the right page,
// each a small-capitals tab over a rule, the board with its evaluation bar, the master moves,
// the engine, and the search. `OpeningExplorer` places them and holds their state.

export function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** One of the right page's slots: its tabs and controls over a rule, and what it holds. */
export function Slot({
  head,
  children,
  className,
  bodyClassName,
}: {
  head: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div className="flex h-[26px] flex-none items-center gap-3 border-b border-rule pb-1">{head}</div>
      {children && <div className={cn("flex min-h-0 flex-1 flex-col gap-2 pt-2", bodyClassName)}>{children}</div>}
    </section>
  );
}

/**
 * A slot's name, underlined in the bookmark's color; one that is `soon` isn't built yet (D16).
 * Given `onPick`, it is one of the slot's tabs, `on` when picked.
 */
export function SlotTab({
  children,
  soon = false,
  on = true,
  onPick,
  disabled = false,
  title,
}: {
  children: ReactNode;
  soon?: boolean;
  on?: boolean;
  onPick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const look = "whitespace-nowrap py-[5px] font-heading text-[10.5px] font-semibold uppercase tracking-[0.11em]";
  if (soon) {
    return (
      <span className={cn(look, "text-muted-foreground opacity-60")} title="Coming soon">
        {children}
        <small className="ml-1 font-mono @max-sm:hidden text-[9px] font-medium tracking-normal normal-case">coming soon</small>
      </span>
    );
  }
  const picked = "text-foreground shadow-[inset_0_-2px_0_var(--bookmark)]";
  if (onPick) {
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        title={title}
        onClick={onPick}
        className={cn(
          look,
          on ? picked : "text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:hover:text-muted-foreground",
        )}
      >
        {children}
      </button>
    );
  }
  return <h2 className={cn(look, picked)}>{children}</h2>;
}

/** A slot's note beside its tab, such as the engine's score. */
export function SlotNote({ children }: { children: ReactNode }) {
  return <span className="truncate font-mono text-[11px] text-muted-foreground">{children}</span>;
}

/**
 * The board, as big a square as its box holds, with the evaluation bar beside it. Its box is a
 * size container, so the board's size comes from the page, never from the viewport.
 */
export function BoardSlot({
  board,
  evalPct,
  orientation,
  className,
}: {
  board: ReactNode;
  /** White's share of the bar, or null with the engine off. */
  evalPct: number | null;
  orientation: "white" | "black";
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 min-w-0 flex-1 [container-type:size]", className)}>
      <div className="mx-auto flex w-fit gap-1.5" style={{ height: "min(100cqh, 100cqw - 16px)" }}>
        <div className="aspect-square h-full">{board}</div>
        <div className="relative w-2.5 overflow-hidden rounded-sm border bg-bar-black">
          {[25, 50, 75].map((pct) => (
            <div key={pct} className="absolute right-0 left-0 z-10 h-px bg-muted-foreground/25" style={{ top: `${pct}%` }} />
          ))}
          <div
            className="absolute w-full bg-bar-white transition-all duration-500"
            style={{ ...(orientation === "black" ? { top: 0 } : { bottom: 0 }), height: `${evalPct ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** White's share of the evaluation bar, or null with the engine off. */
export function evalShare(mode: EngineMode, lines: readonly EngineLine[]): number | null {
  if (mode === "none") return null;
  const top = lines[0];
  return top ? evalToBarPct(top.score, top.mate) : 50;
}

/** The flip button and the search, whose picked line the navigator steps through. */
export function ExplorerSearch({
  orientation,
  onFlip,
  onPick,
}: {
  orientation: "white" | "black";
  onFlip: () => void;
  onPick: (match: CatalogMatch) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const blurRef = useRef<number | null>(null);
  const results = query.length > 0 ? searchCatalogMatches(query, 8) : [];

  useEffect(
    () => () => {
      if (blurRef.current !== null) window.clearTimeout(blurRef.current);
    },
    [],
  );

  const pick = (match: CatalogMatch) => {
    onPick(match);
    setQuery("");
    setFocused(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={onFlip} title="Flip board">
        <ArrowUpDown aria-hidden="true" />
        {orientation === "white" ? "White" : "Black"}
      </Button>
      <div className="relative min-w-0 flex-1">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurRef.current !== null) window.clearTimeout(blurRef.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurRef.current = window.setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setFocused(false);
            }
          }}
          placeholder="Search — Sicilian, B12…"
          aria-label="Search openings"
          className="h-7 px-2"
        />
        {focused && results.length > 0 && (
          <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {results.map((result) => (
              <button
                key={`${result.eco}-${result.name}-${result.pgn}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(result);
                }}
                className="flex w-full items-center gap-2.5 border-b px-2.5 py-1.5 text-left last:border-0 hover:bg-accent"
              >
                <span className="w-9 shrink-0 font-mono text-xs font-semibold text-muted-foreground">{result.eco}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{result.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{result.pgn}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{result.moves.length}m</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The engine's controls, for its slot's head: the arrow on the board, and None, Light or Heavy. */
export function EngineControls({
  mode,
  onMode,
  arrow,
  onArrow,
}: {
  mode: EngineMode;
  onMode: (mode: EngineMode) => void;
  arrow: boolean;
  onArrow: (arrow: boolean) => void;
}) {
  return (
    <>
      {/* Hidden, not removed, with the engine off, so the toggles never shift. */}
      <Toggle
        variant="outline"
        size="sm"
        pressed={arrow}
        onPressedChange={onArrow}
        title={arrow ? "Hide engine arrow" : "Show engine arrow"}
        className={cn(
          "h-6 min-w-0 px-2 text-xs data-[state=on]:border-warning/50 data-[state=on]:bg-transparent data-[state=on]:text-warning",
          mode === "none" && "invisible",
        )}
      >
        <MoveUpRight aria-hidden="true" className="size-3" />
        Arrow
      </Toggle>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Engine"
        value={mode}
        onValueChange={(value) => {
          if (value) onMode(value as EngineMode);
        }}
      >
        {(["none", "light", "heavy"] as const).map((m) => (
          <ToggleGroupItem
            key={m}
            value={m}
            className="h-6 min-w-0 px-2 text-xs capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {m}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  );
}

/** The engine's score and depth, for its slot's head. */
export function engineNote(ready: boolean, analyzing: boolean, lines: readonly EngineLine[]): string {
  if (!ready) return "Loading engine…";
  const top = lines[0];
  const score = top ? formatScore(top.score, top.mate) : "—";
  return `${score} · depth ${top?.depth ?? (analyzing ? "…" : "—")}`;
}

/** The engine's lines, each its score and first moves. */
export function EngineLines({ lines }: { lines: readonly EngineLine[] }) {
  return (
    <div className="-mt-1 flex flex-col">
      {lines.map((line) => (
        <div key={line.multipv} className="flex items-baseline gap-2.5 border-b border-rule py-1 text-[12.5px]">
          <span className="w-10 shrink-0 font-mono font-semibold tabular-nums">{formatScore(line.score, line.mate)}</span>
          <span className="truncate font-mono text-muted-foreground">{line.pvSan.slice(0, 6).join(" ")}</span>
        </div>
      ))}
    </div>
  );
}

/** What the masters played here, each move with how its games ended; a move is played on a press. */
export function MasterMoves({
  moves,
  hoveredUci,
  markedSan,
  onPlay,
  onHover,
}: {
  moves: readonly ExplorerMove[];
  hoveredUci: string | null;
  /** The picked line's next move, when it starts here. */
  markedSan: string | null;
  onPlay: (move: ExplorerMove) => void;
  onHover: (uci: string | null) => void;
}) {
  const columns = "grid grid-cols-[2.5rem_1fr_3.5rem] items-center gap-3";
  return (
    <div>
      <div className={cn(columns, "book-sc mb-1 px-1.5")}>
        <span>Move</span>
        <span className="truncate">White · Draw · Black</span>
        <span className="text-right">Games</span>
      </div>
      <div onMouseLeave={() => onHover(null)}>
        {moves.map((move) => {
          const total = move.white + move.draws + move.black;
          if (total === 0) return null;
          const pct = (n: number) => (n / total) * 100;
          const marked = markedSan === move.san;
          return (
            <div
              key={move.uci}
              role="button"
              tabIndex={0}
              onClick={() => onPlay(move)}
              onMouseEnter={() => onHover(move.uci)}
              onMouseLeave={() => onHover(null)}
              onKeyDown={(e) => e.key === "Enter" && onPlay(move)}
              className={cn(
                columns,
                "cursor-pointer rounded-sm px-1.5 py-1 transition-colors",
                hoveredUci === move.uci || marked ? "bg-accent" : "hover:bg-accent",
              )}
            >
              <span className={cn("text-[13px] font-bold", marked && "underline decoration-muted-foreground underline-offset-2")}>
                {move.san}
              </span>
              <div data-slot="move-bar" className="flex h-2 overflow-hidden rounded-xs">
                <div className="bg-bar-white" style={{ width: `${pct(move.white)}%` }} title={`White ${Math.round(pct(move.white))}%`} />
                <div className="bg-bar-draw" style={{ width: `${pct(move.draws)}%` }} title={`Draw ${Math.round(pct(move.draws))}%`} />
                <div className="bg-bar-black" style={{ width: `${pct(move.black)}%` }} title={`Black ${Math.round(pct(move.black))}%`} />
              </div>
              <span className="text-right font-mono text-[11.5px] text-muted-foreground tabular-nums">{formatGames(total)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
