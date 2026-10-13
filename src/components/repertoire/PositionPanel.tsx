"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { Button } from "@/components/shadcn/button";
import { Panel, PanelLabel } from "@/components/ui/Panel";
import type { MasterSummary } from "@/lib/chess/explorerData";
import type { LibraryEntry } from "@/lib/library/types";

/** How many of the position's moves the panel lists. */
const LISTED_MOVES = 5;

export type PanelMasterGames = {
  loading: boolean;
  /** Null until the position's master games have loaded, or when they didn't. */
  summary: MasterSummary | null;
  /** Shown when there are no games to show. */
  emptyText: string;
};

type Props = {
  /** The position shown, or null when there is none. */
  position: { fen: string; title: string } | null;
  /** The header's text when there is no position. */
  emptyTitle: string;
  /** The body's text when there is no position (wide screens only). */
  emptyHint: string;
  book: LibraryEntry | null;
  masterGames: PanelMasterGames;
  onClose?: () => void;
  /** The buttons in the actions panel. */
  actions: ReactNode;
  /** Panels under the actions panel. */
  children?: ReactNode;
};

function fmtGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * The side panel for one position: its board, master-game figures and actions. The Treemap
 * and the Labyrinth each wrap it with their own data and buttons.
 */
export function PositionPanel({
  position,
  emptyTitle,
  emptyHint,
  book,
  masterGames,
  onClose,
  actions,
  children,
}: Props) {
  const { loading, summary } = masterGames;
  const hasGames = !loading && summary !== null && summary.games > 0;

  return (
    // Narrow: a strip under the view that grows to at most half the page once it has a position.
    <aside className="flex max-h-[50%] w-full shrink-0 flex-col gap-2 overflow-y-auto lg:h-full lg:max-h-none lg:w-72">
      {/* Header */}
      <Panel className="flex shrink-0 items-center justify-between px-2.5 py-2">
        <div className="min-w-0">
          {book && <PanelLabel className="truncate">{book.name}</PanelLabel>}
          <p className="truncate font-heading text-sm font-semibold">
            {position ? position.title : emptyTitle}
          </p>
        </div>
        {position && onClose && (
          <Button variant="ghost" size="icon-xs" className="ml-2" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        )}
      </Panel>

      {/* Empty state */}
      {!position && (
        <Panel className="hidden flex-1 items-center justify-center p-4 text-center lg:flex">
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        </Panel>
      )}

      {position && (
        <>
          {/* Board */}
          <Panel className="shrink-0 overflow-hidden p-1.5">
            <BoardDisplay fen={position.fen} size="md" orientation={book?.color ?? "white"} animate />
          </Panel>

          {/* Master game stats */}
          <Panel className="shrink-0 px-2.5 py-2">
            <PanelLabel>Master games</PanelLabel>
            {loading && <p className="mt-1 text-xs text-muted-foreground">Loading…</p>}
            {hasGames && (
              <>
                <p className="mt-0.5 text-sm font-semibold">{fmtGames(summary.games)} games</p>
                <div data-slot="move-bar" className="mt-1 flex h-1.5 overflow-hidden rounded-xs">
                  <div className="bg-bar-white" style={{ width: `${summary.whitePct}%` }} />
                  <div className="bg-bar-draw" style={{ width: `${summary.drawPct}%` }} />
                  <div className="bg-bar-black" style={{ width: `${summary.blackPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.whitePct}% W · {summary.drawPct}% D · {summary.blackPct}% B
                </p>
                {summary.moves.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
                    {summary.moves.slice(0, LISTED_MOVES).map((m) => (
                      <div key={m.uci} className="flex items-center justify-between text-xs">
                        <span className="font-mono">{m.san}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {m.pct}% · {fmtGames(m.games)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!loading && !hasGames && (
              <p className="mt-1 text-xs text-muted-foreground">{masterGames.emptyText}</p>
            )}
          </Panel>

          {/* Training stats placeholder */}
          <Panel className="shrink-0 border-dashed px-2.5 py-2">
            <PanelLabel>Your stats</PanelLabel>
            <p className="mt-0.5 text-xs text-muted-foreground">Coming soon</p>
          </Panel>

          {/* Actions */}
          <Panel className="grid shrink-0 gap-1.5 p-2">{actions}</Panel>
        </>
      )}

      {children}
    </aside>
  );
}
