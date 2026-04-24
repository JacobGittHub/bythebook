"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { getCatalogMatchesForFen } from "@/lib/chess/openingCatalog";
import type { MoveResult } from "@/hooks/useChessGame";
import type { ExplorerMove } from "@/types/chess";

// ── Layout constants ────────────────────────────────────────────────────────

const MAX_HISTORY = 40;
const MAX_CONT = 3;

const VB_H = 160;
const CY = VB_H / 2; // 80

const CHAIN_X_START = 28;
const NODE_STEP = 40;    // px between consecutive history nodes (viewBox units)
const CONT_OFFSET = 120; // px from curX to continuation nodes
const TOOLTIP_W = 144;   // w-36 in px

// ── Types ───────────────────────────────────────────────────────────────────

type TooltipData = {
  fen: string;
  san: string | null;
  move: ExplorerMove | null;
  divergedPct: number | null;
  mouseX: number;
  mouseY: number;
};

type Props = {
  moveHistory: MoveResult[];
  explorerMoves: ExplorerMove[];
  currentFen: string;
  historyPlayedFractions?: (number | null)[];
  boardOrientation?: "white" | "black";
  onMoveClick: (move: ExplorerMove) => void;
  onHoverUci: (uci: string | null) => void;
  hoveredUci: string | null;
};

// ── Shared edge-width formula ────────────────────────────────────────────────

const calcEdgeWidth = (fraction: number | null): number => {
  if (fraction === null) return 1.5;
  return 1.2 + fraction * 5.5;
};

// ── Component ───────────────────────────────────────────────────────────────

export function OpeningMiniTree({
  moveHistory,
  explorerMoves,
  currentFen,
  historyPlayedFractions,
  boardOrientation = "white",
  onMoveClick,
  onHoverUci,
  hoveredUci,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleHistory = moveHistory.slice(-MAX_HISTORY);
  const topMoves = explorerMoves.slice(0, MAX_CONT);
  const hasCont = topMoves.length > 0;
  const hasMoreHistory = moveHistory.length > MAX_HISTORY;

  // Auto-scroll to current node when history grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moveHistory.length]);

  // Compute FEN after each continuation move (chess.js, no API call)
  const contFens = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of topMoves) {
      try {
        const chess = new Chess(currentFen);
        const r = chess.move({
          from: m.uci.slice(0, 2),
          to: m.uci.slice(2, 4),
          promotion: m.uci.length > 4 ? m.uci[4] : undefined,
        });
        if (r) map[m.uci] = chess.fen();
      } catch { /* skip illegal move */ }
    }
    return map;
  }, [currentFen, topMoves]);

  // ── Layout computation ───────────────────────────────────────────────────

  const histXs = visibleHistory.map((_, i) => CHAIN_X_START + i * NODE_STEP);
  const curX = CHAIN_X_START + visibleHistory.length * NODE_STEP;
  const contX = curX + CONT_OFFSET;
  const svgWidth = Math.max(hasCont ? contX + 40 : curX + 40, 200);

  const contYs: number[] = useMemo(() => {
    if (topMoves.length === 0) return [];
    if (topMoves.length === 1) return [CY];
    if (topMoves.length === 2) return [CY - 38, CY + 38];
    return [CY - 52, CY, CY + 52];
  }, [topMoves.length]);

  const totalContGames = topMoves.reduce((s, m) => s + m.white + m.draws + m.black, 0);
  const contEdgeWidth = (m: ExplorerMove) => {
    if (totalContGames === 0) return 1.5;
    return 1.2 + ((m.white + m.draws + m.black) / totalContGames) * 5.5;
  };

  // Offset into historyPlayedFractions for the visible window
  const fractionOffset = Math.max(0, moveHistory.length - MAX_HISTORY);

  if (visibleHistory.length === 0 && topMoves.length === 0) return null;

  const show = (
    fen: string,
    san: string | null,
    move: ExplorerMove | null,
    divergedPct: number | null,
    e: React.MouseEvent,
  ) => setTooltip({ fen, san, move, divergedPct, mouseX: e.clientX, mouseY: e.clientY });
  const hide = () => setTooltip(null);

  return (
    <>
      <div
        ref={scrollRef}
        className="h-full overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: "smooth" }}
        onMouseLeave={() => { hide(); onHoverUci(null); }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${VB_H}`}
          style={{ height: "100%", aspectRatio: `${svgWidth} / ${VB_H}`, display: "block" }}
          preserveAspectRatio="xMinYMid meet"
        >
          {/* Cap indicator */}
          {hasMoreHistory && (
            <text
              x={CHAIN_X_START - 14}
              y={CY + 4}
              fontSize={11}
              fill="var(--text-muted)"
              opacity={0.35}
              textAnchor="middle"
            >
              ···
            </text>
          )}

          {/* History edges + divergence ghost edges */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const fraction = historyPlayedFractions?.[fIdx] ?? null;
            const diverged = fraction !== null ? 1 - fraction : null;
            const x1 = histXs[i];
            const x2 = i === visibleHistory.length - 1 ? curX : histXs[i + 1];
            return (
              <g key={`he-${i}`}>
                <line
                  x1={x1} y1={CY}
                  x2={x2} y2={CY}
                  stroke="var(--border-card)"
                  strokeWidth={calcEdgeWidth(fraction)}
                />
                {diverged !== null && diverged > 0.15 && (
                  <>
                    <line
                      x1={x1} y1={CY}
                      x2={x1 + 14} y2={CY + 26}
                      stroke="var(--text-muted)"
                      strokeWidth={calcEdgeWidth(diverged)}
                      strokeOpacity={0.35}
                      strokeLinecap="round"
                    />
                    <text
                      x={x1 + 18}
                      y={CY + 38}
                      textAnchor="middle"
                      fontSize={6.5}
                      fill="var(--text-muted)"
                      opacity={0.45}
                    >
                      {Math.round(diverged * 100)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Continuation edges */}
          {topMoves.map((m, i) => (
            <line
              key={`ce-${m.uci}`}
              x1={curX} y1={CY}
              x2={contX} y2={contYs[i]}
              stroke="var(--text-muted)"
              strokeWidth={contEdgeWidth(m)}
              strokeOpacity={0.5}
            />
          ))}

          {/* History nodes */}
          {visibleHistory.map((h, i) => {
            const fIdx = fractionOffset + i;
            const fraction = historyPlayedFractions?.[fIdx] ?? null;
            const divergedPct = fraction !== null ? 1 - fraction : null;
            return (
              <g
                key={`hn-${i}`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => show(h.fen, h.san, null, divergedPct, e)}
                onMouseLeave={hide}
              >
                <circle
                  cx={histXs[i]} cy={CY} r={5}
                  fill="var(--bg-muted)"
                  stroke="var(--border-card)"
                  strokeWidth={1.5}
                />
                <text
                  x={histXs[i]} y={CY - 10}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill="var(--text-muted)"
                >
                  {h.san}
                </text>
              </g>
            );
          })}

          {/* Current position node */}
          <g
            onMouseEnter={(e) =>
              show(currentFen, visibleHistory.at(-1)?.san ?? null, null, null, e)
            }
            onMouseLeave={hide}
          >
            <circle
              cx={curX} cy={CY} r={7}
              fill="var(--bg-sidebar)"
              stroke="var(--border-card)"
              strokeWidth={1.5}
            />
          </g>

          {/* No-data indicator */}
          {!hasCont && (
            <text
              x={curX + 20} y={CY + 4}
              fontSize={11}
              fill="var(--text-muted)"
              opacity={0.35}
            >
              ···
            </text>
          )}

          {/* Continuation nodes */}
          {topMoves.map((m, i) => {
            const isHov = hoveredUci === m.uci;
            return (
              <g
                key={`cn-${m.uci}`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  onHoverUci(m.uci);
                  show(contFens[m.uci] ?? currentFen, m.san, m, null, e);
                }}
                onMouseLeave={() => { onHoverUci(null); hide(); }}
                onClick={() => onMoveClick(m)}
              >
                <circle
                  cx={contX} cy={contYs[i]} r={5}
                  fill={isHov ? "var(--bg-muted)" : "var(--bg-card)"}
                  stroke={isHov ? "var(--text-primary)" : "var(--border-card)"}
                  strokeWidth={1.5}
                />
                <text
                  x={contX} y={contYs[i] - 9}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={isHov ? "var(--text-primary)" : "var(--text-muted)"}
                  fontWeight={isHov ? "600" : "400"}
                >
                  {m.san}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {tooltip && (
        <MiniTreeTooltip tooltip={tooltip} boardOrientation={boardOrientation} />
      )}
    </>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

function MiniTreeTooltip({
  tooltip,
  boardOrientation,
}: {
  tooltip: TooltipData;
  boardOrientation: "white" | "black";
}) {
  const openingName = getCatalogMatchesForFen(tooltip.fen, 1)[0]?.name;
  const m = tooltip.move;
  const total = m ? m.white + m.draws + m.black : 0;
  const wPct = total > 0 ? Math.round((m!.white / total) * 100) : 0;
  const dPct = total > 0 ? Math.round((m!.draws / total) * 100) : 0;
  const bPct = total > 0 ? Math.round((m!.black / total) * 100) : 0;

  const fmtGames = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K`
    : String(n);

  const nearRightEdge = tooltip.mouseX + 14 + TOOLTIP_W > window.innerWidth;

  return (
    <div
      className="pointer-events-none fixed z-50 w-36 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
      style={{
        left: nearRightEdge ? undefined : tooltip.mouseX + 14,
        right: nearRightEdge ? window.innerWidth - tooltip.mouseX + 14 : undefined,
        top: Math.max(tooltip.mouseY - 220, 8),
      }}
    >
      <BoardDisplay fen={tooltip.fen} size="sm" orientation={boardOrientation} />
      <div className="mt-1.5 space-y-0.5">
        {tooltip.san && (
          <p className="text-xs font-semibold text-slate-800">{tooltip.san}</p>
        )}
        {openingName && (
          <p className="truncate text-xs text-slate-500">{openingName}</p>
        )}
        {m && total > 0 && (
          <>
            <p className="text-xs text-slate-400">{fmtGames(total)} games</p>
            <div className="flex h-1.5 overflow-hidden rounded-full">
              <div style={{ width: `${wPct}%`, backgroundColor: "var(--bar-white)" }} />
              <div style={{ width: `${dPct}%`, backgroundColor: "var(--bar-draw)" }} />
              <div style={{ width: `${bPct}%`, backgroundColor: "var(--bar-black)" }} />
            </div>
          </>
        )}
        {tooltip.divergedPct !== null && tooltip.divergedPct > 0.15 && (
          <p className="text-xs text-slate-400">
            {Math.round(tooltip.divergedPct * 100)}% chose differently
          </p>
        )}
      </div>
    </div>
  );
}
