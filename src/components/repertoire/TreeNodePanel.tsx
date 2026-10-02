"use client";

import { useRouter } from "next/navigation";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { getCatalogMatchesForFen } from "@/lib/chess/openingCatalog";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import type { ExplorerMove, OpeningBook } from "@/types/chess";
import type { DisplayNode } from "./OpeningTreeFull";

type Props = {
  node: DisplayNode | null;
  book: OpeningBook | null;
  isExpanded: boolean;
  onAddToBook: () => void;
  onRemoveFromBook: () => void;
  onExpand: (moves: ExplorerMove[]) => void;
  onClose: () => void;
};

function fmtGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function TreeNodePanel({
  node,
  book,
  isExpanded,
  onAddToBook,
  onRemoveFromBook,
  onExpand,
  onClose,
}: Props) {
  const router = useRouter();
  const explorerData = useOpeningExplorer(node?.fen ?? "");
  const openingName = node ? getCatalogMatchesForFen(node.fen, 1)[0]?.name : undefined;

  const isRoot = node?.id === "root";
  const isGhost = Boolean(node?.isGhost);

  const moves = explorerData.data?.moves ?? [];
  const total = moves.reduce((s, m) => s + m.white + m.draws + m.black, 0);
  const wPct = total > 0 ? Math.round((moves.reduce((s, m) => s + m.white, 0) / total) * 100) : 0;
  const dPct = total > 0 ? Math.round((moves.reduce((s, m) => s + m.draws, 0) / total) * 100) : 0;
  const bPct = 100 - wPct - dPct;

  return (
    // Narrow: a strip under the tree that grows to at most half the page once a node is picked.
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
            {!node ? "Select a position" : isRoot ? "Starting Position" : (openingName ?? node.san ?? "Unknown")}
          </p>
        </div>
        {node && (
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
      {!node && (
        <div className="hidden flex-1 items-center justify-center rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-6 text-center lg:flex">
          <p className="text-sm text-[var(--text-muted)] opacity-60">
            Click any node in the tree to explore that position.
          </p>
        </div>
      )}

      {node && (
        <>
          {/* Board */}
          <div className="shrink-0 overflow-hidden rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-3">
            <BoardDisplay fen={node.fen} size="md" orientation={book?.color ?? "white"} />
          </div>

          {/* Master game stats */}
          <div className="shrink-0 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
              Master games
            </p>
            {explorerData.loading && (
              <p className="mt-2 text-xs text-[var(--text-muted)] opacity-50">Loading…</p>
            )}
            {!explorerData.loading && total > 0 && (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fmtGames(total)} games</p>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                  <div style={{ width: `${wPct}%`, backgroundColor: "var(--bar-white)" }} />
                  <div style={{ width: `${dPct}%`, backgroundColor: "var(--bar-draw)" }} />
                  <div style={{ width: `${bPct}%`, backgroundColor: "var(--bar-black)" }} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {wPct}% W · {dPct}% D · {bPct}% B
                </p>
                {moves.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-[var(--border-card)] pt-2">
                    {moves.slice(0, 5).map((m) => {
                      const g = m.white + m.draws + m.black;
                      const pct = total > 0 ? Math.round((g / total) * 100) : 0;
                      return (
                        <div key={m.uci} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-800">{m.san}</span>
                          <span className="text-[var(--text-muted)]">{pct}% · {fmtGames(g)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {!explorerData.loading && total === 0 && (
              <p className="mt-2 text-xs text-[var(--text-muted)] opacity-50">
                {/* A 404 is the route's answer to a guest for a position it hasn't saved. */}
                {explorerData.error === "404"
                  ? "Not saved yet. Live lookups need a beta account."
                  : "No master game data."}
              </p>
            )}
          </div>

          {/* Training stats placeholder */}
          <div className="shrink-0 rounded-3xl border border-dashed border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Your stats</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] opacity-50">Coming soon</p>
          </div>

          {/* Actions */}
          <div className="shrink-0 space-y-2 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
            {book && !isRoot && (
              isGhost ? (
                <button onClick={onAddToBook} className="btn-primary w-full rounded-2xl px-3 py-2 text-sm font-medium">
                  Add to book
                </button>
              ) : (
                <button onClick={onRemoveFromBook} className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm">
                  Remove from book
                </button>
              )
            )}

            {explorerData.data && moves.length > 0 && (
              <button onClick={() => onExpand(moves)} className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm">
                {isExpanded ? "Collapse branch" : "Expand branch"}
              </button>
            )}

            <button
              onClick={() => router.push(`/dashboard/explorer?fen=${encodeURIComponent(node.fen)}`)}
              className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm"
            >
              Open in Explorer
            </button>

            {book && (
              <button onClick={() => router.push(`/dashboard/train/${book.id}`)} className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm">
                Train this book
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
