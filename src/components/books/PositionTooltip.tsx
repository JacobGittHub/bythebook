"use client";

import { BoardDisplay } from "@/components/board/BoardDisplay";
import { moveLabel, pathTo, type ViewNode } from "@/lib/books/viewTree";
import type { Point } from "@/lib/books/views/common";
import { gameCount } from "@/lib/chess/explorerData";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import type { ExplorerMove } from "@/types/chess";

const WIDTH = 152;

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * A floating board for the position under the pointer, with its move, its opening and, when
 * known, how its master games ended. It follows the pointer and never takes the pointer itself.
 */
export function PositionTooltip({
  node,
  pointer,
  stats,
  orientation,
}: {
  node: ViewNode;
  pointer: Point;
  stats?: ExplorerMove;
  orientation: "white" | "black";
}) {
  const opening = getOpeningForLine(
    pathTo(node)
      .slice(1)
      .map((n) => n.fen),
  )?.name;
  const total = stats ? gameCount(stats) : 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const nearRight = typeof window !== "undefined" && pointer.x + 14 + WIDTH > window.innerWidth;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md"
      style={{
        width: WIDTH,
        left: nearRight ? undefined : pointer.x + 14,
        right: nearRight ? window.innerWidth - pointer.x + 14 : undefined,
        top: Math.max(pointer.y - 230, 8),
      }}
    >
      <BoardDisplay fen={node.fen} size="sm" orientation={orientation} />
      <p className="mt-1.5 text-xs font-semibold text-foreground">{moveLabel(node)}</p>
      {opening && <p className="truncate text-xs text-muted-foreground">{opening}</p>}
      {stats && total > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{formatGames(total)} master games</p>
          <div data-slot="move-bar" className="mt-0.5 flex h-1.5 overflow-hidden rounded-xs">
            <div className="bg-bar-white" style={{ width: `${pct(stats.white)}%` }} />
            <div className="bg-bar-draw" style={{ width: `${pct(stats.draws)}%` }} />
            <div className="bg-bar-black" style={{ width: `${pct(stats.black)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
