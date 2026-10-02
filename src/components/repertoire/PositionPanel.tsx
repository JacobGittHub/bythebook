"use client";

import type { ReactNode } from "react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import type { MasterSummary } from "@/lib/chess/explorerData";
import type { OpeningBook } from "@/types/chess";

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
  book: OpeningBook | null;
  masterGames: PanelMasterGames;
  onClose?: () => void;
  /** The buttons in the actions card. */
  actions: ReactNode;
  /** Cards under the actions card. */
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
    <aside className="flex max-h-[50%] w-full shrink-0 flex-col gap-2 overflow-y-auto lg:h-full lg:max-h-none lg:w-72 lg:gap-3">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
        <div className="min-w-0">
          {book && (
            <p className="truncate text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
              {book.name}
            </p>
          )}
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
            {position ? position.title : emptyTitle}
          </p>
        </div>
        {position && onClose && (
          <button
            onClick={onClose}
            className="ml-2 shrink-0 rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Empty state */}
      {!position && (
        <div className="hidden flex-1 items-center justify-center rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-6 text-center lg:flex">
          <p className="text-sm text-[var(--text-muted)] opacity-60">{emptyHint}</p>
        </div>
      )}

      {position && (
        <>
          {/* Board */}
          <div className="shrink-0 overflow-hidden rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-3">
            <BoardDisplay fen={position.fen} size="md" orientation={book?.color ?? "white"} animate />
          </div>

          {/* Master game stats */}
          <div className="shrink-0 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
              Master games
            </p>
            {loading && <p className="mt-2 text-xs text-[var(--text-muted)] opacity-50">Loading…</p>}
            {hasGames && (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fmtGames(summary.games)} games</p>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                  <div style={{ width: `${summary.whitePct}%`, backgroundColor: "var(--bar-white)" }} />
                  <div style={{ width: `${summary.drawPct}%`, backgroundColor: "var(--bar-draw)" }} />
                  <div style={{ width: `${summary.blackPct}%`, backgroundColor: "var(--bar-black)" }} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {summary.whitePct}% W · {summary.drawPct}% D · {summary.blackPct}% B
                </p>
                {summary.moves.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-[var(--border-card)] pt-2">
                    {summary.moves.slice(0, LISTED_MOVES).map((m) => (
                      <div key={m.uci} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-800">{m.san}</span>
                        <span className="text-[var(--text-muted)]">
                          {m.pct}% · {fmtGames(m.games)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!loading && !hasGames && (
              <p className="mt-2 text-xs text-[var(--text-muted)] opacity-50">{masterGames.emptyText}</p>
            )}
          </div>

          {/* Training stats placeholder */}
          <div className="shrink-0 rounded-3xl border border-dashed border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Your stats</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] opacity-50">Coming soon</p>
          </div>

          {/* Actions */}
          <div className="shrink-0 space-y-2 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            {actions}
          </div>
        </>
      )}

      {children}
    </aside>
  );
}
