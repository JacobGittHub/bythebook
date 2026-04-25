"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { getCatalogMatchesForFen } from "@/lib/chess/openingCatalog";
import { START_FEN } from "@/lib/chess/fen";
import type { MoveResult } from "@/hooks/useChessGame";
import type { ExplorerMove } from "@/types/chess";

// ── Layout constants ────────────────────────────────────────────────────────

const MAX_HISTORY = 40;
const MAX_CONT = 3;
const MAX_ALTS = 2;
const ALT_Y_OFF = 32;  // y distance from main line to alternate nodes
const ALT_X_OFF = 10;  // x nudge toward continuation direction (inward angle)

const VB_H = 160;
const CY = VB_H / 2;  // 80

const CHAIN_X_START = 28;
const NODE_STEP = 40;    // viewBox px between consecutive history nodes
const CONT_OFFSET = 120; // viewBox px from curX to continuation nodes
const TOOLTIP_W = 144;   // w-36 in px

// ── Types ───────────────────────────────────────────────────────────────────

export type HistoryAltEntry = { alts: ExplorerMove[]; total: number };

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
  historyPlayedGames?: (number | null)[];
  historyAlternates?: (HistoryAltEntry | null)[];
  boardOrientation?: "white" | "black";
  onMoveClick: (move: ExplorerMove) => void;
  onHistoryNodeClick?: (fullMoveIndex: number) => void;
  onHistoryAlternateClick?: (fullMoveIndex: number, move: ExplorerMove) => void;
  onHoverUci: (uci: string | null) => void;
  hoveredUci: string | null;
};

// ── Edge-width formula — piecewise linear over absolute game counts ──────────
//
// Adjust these three constants to tune the visual:
//   GAMES_KNEE  — below this: hairline → 60 % of max  (default 50 000)
//   GAMES_SAT   — at/above this: 100 % of max           (default 2 000 000)
//   MIN_W / MAX_W — stroke-width range

const GAMES_KNEE = 50_000;
const GAMES_SAT  = 2_000_000;
const MIN_W = 1.2;
const MAX_W = 6.7;
const MID_W = MIN_W + 0.6 * (MAX_W - MIN_W); // 4.5 — 60 % of range

const calcEdgeWidth = (games: number | null): number => {
  if (games === null || games <= 0) return MIN_W;
  if (games < GAMES_KNEE) {
    return MIN_W + (games / GAMES_KNEE) * (MID_W - MIN_W);
  }
  const t = Math.min((games - GAMES_KNEE) / (GAMES_SAT - GAMES_KNEE), 1);
  return MID_W + t * (MAX_W - MID_W);
};

// ── Label y: above top alternates, below bottom alternates ──────────────────

const altSanLabelY  = (y: number): number => (y >= CY ? y + 12 : y - 9);
const altPctLabelY  = (y: number): number => (y >= CY ? y + 20 : y - 17);

// ── Component ───────────────────────────────────────────────────────────────

export function OpeningMiniTree({
  moveHistory,
  explorerMoves,
  currentFen,
  historyPlayedFractions,
  historyPlayedGames,
  historyAlternates,
  boardOrientation = "white",
  onMoveClick,
  onHistoryNodeClick,
  onHistoryAlternateClick,
  onHoverUci,
  hoveredUci,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleHistory = moveHistory.slice(-MAX_HISTORY);
  const topMoves = explorerMoves.slice(0, MAX_CONT);
  const hasCont = topMoves.length > 0;
  const hasMoreHistory = moveHistory.length > MAX_HISTORY;
  const fractionOffset = Math.max(0, moveHistory.length - MAX_HISTORY);

  // Auto-scroll to current (rightmost) node when history grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moveHistory.length]);


  // Compute FEN after each continuation move (no API call)
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

  // Compute FEN after each alternate move — keyed by `${fullIdx}-${alt.uci}`
  const altFens = useMemo(() => {
    const map: Record<string, string> = {};
    const offset = Math.max(0, moveHistory.length - MAX_HISTORY);
    const count = Math.min(moveHistory.length, MAX_HISTORY);
    for (let i = 0; i < count; i++) {
      const fIdx = offset + i;
      const entry = historyAlternates?.[fIdx];
      if (!entry) continue;
      const beforeFen = fIdx === 0 ? START_FEN : moveHistory[fIdx - 1].fen;
      for (const alt of entry.alts.slice(0, MAX_ALTS)) {
        try {
          const chess = new Chess(beforeFen);
          const r = chess.move({
            from: alt.uci.slice(0, 2),
            to: alt.uci.slice(2, 4),
            promotion: alt.uci.length > 4 ? alt.uci[4] : undefined,
          });
          if (r) map[`${fIdx}-${alt.uci}`] = chess.fen();
        } catch { /* skip */ }
      }
    }
    return map;
  }, [moveHistory, historyAlternates]);

  // ── Layout ────────────────────────────────────────────────────────────────

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

  const contEdgeWidth = (m: ExplorerMove) =>
    calcEdgeWidth(m.white + m.draws + m.black);

  // Alternate node positions — angled inward (x offset toward continuations)
  const altPositions = (baseX: number, count: number): { x: number; y: number }[] => {
    if (count === 1) return [{ x: baseX + ALT_X_OFF, y: CY - ALT_Y_OFF }];
    return [
      { x: baseX + ALT_X_OFF, y: CY - ALT_Y_OFF },
      { x: baseX + ALT_X_OFF, y: CY + ALT_Y_OFF },
    ];
  };

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
      {/* w-full constrains the container so overflow-x-auto activates scrolling */}
      <div
        ref={scrollRef}
        className="h-full w-full overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: "smooth" }}
        onMouseLeave={() => { hide(); onHoverUci(null); }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${VB_H}`}
          width={svgWidth}
          height="100%"
          style={{ display: "block" }}
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

          {/* ── Edges (drawn beneath nodes) ────────────────────────────── */}

          {/* History edges — width from absolute game count for each played move */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            return (
              <line
                key={`he-${i}`}
                x1={histXs[i]} y1={CY}
                x2={i === visibleHistory.length - 1 ? curX : histXs[i + 1]} y2={CY}
                stroke="var(--border-card)"
                strokeWidth={calcEdgeWidth(historyPlayedGames?.[fIdx] ?? null)}
              />
            );
          })}

          {/* Alternate edges — angled inward, width from absolute game count */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const entry = historyAlternates?.[fIdx];
            if (!entry) return null;
            const alts = entry.alts.slice(0, MAX_ALTS);
            const positions = altPositions(histXs[i], alts.length);
            return alts.map((alt, j) => (
              <line
                key={`ae-${fIdx}-${alt.uci}`}
                x1={histXs[i]} y1={CY}
                x2={positions[j].x} y2={positions[j].y}
                stroke="var(--text-muted)"
                strokeWidth={calcEdgeWidth(alt.white + alt.draws + alt.black)}
                strokeOpacity={0.4}
                strokeLinecap="round"
              />
            ));
          })}

          {/* Continuation edges — width relative to each other from current position */}
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

          {/* ── Nodes (drawn above edges) ──────────────────────────────── */}

          {/* Alternate nodes — dashed hollow, angled inward, with SAN + % labels */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const entry = historyAlternates?.[fIdx];
            if (!entry) return null;
            const alts = entry.alts.slice(0, MAX_ALTS);
            const positions = altPositions(histXs[i], alts.length);
            return alts.map((alt, j) => {
              const fen = altFens[`${fIdx}-${alt.uci}`] ?? currentFen;
              const localFrac = (alt.white + alt.draws + alt.black) / entry.total;
              const pct = Math.round(localFrac * 100);
              const pos = positions[j];
              return (
                <g
                  key={`an-${fIdx}-${alt.uci}`}
                  style={{ cursor: onHistoryAlternateClick ? "pointer" : "default" }}
                  onMouseEnter={(e) => show(fen, alt.san, alt, null, e)}
                  onMouseLeave={hide}
                  onClick={() => onHistoryAlternateClick?.(fIdx, alt)}
                >
                  <circle
                    cx={pos.x} cy={pos.y} r={4}
                    fill="var(--bg-card)"
                    stroke="var(--border-card)"
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={pos.x}
                    y={altSanLabelY(pos.y)}
                    textAnchor="middle"
                    fontSize={7}
                    fill="var(--text-muted)"
                    opacity={0.75}
                  >
                    {alt.san}
                  </text>
                  <text
                    x={pos.x}
                    y={altPctLabelY(pos.y)}
                    textAnchor="middle"
                    fontSize={6}
                    fill="var(--text-muted)"
                    opacity={0.5}
                  >
                    {pct}%
                  </text>
                </g>
              );
            });
          })}

          {/* History nodes — clickable, navigate back to that position */}
          {visibleHistory.map((h, i) => {
            const fIdx = fractionOffset + i;
            const fraction = historyPlayedFractions?.[fIdx] ?? null;
            const divergedPct = fraction !== null ? 1 - fraction : null;
            const isLast = fIdx === moveHistory.length - 1;
            return (
              <g
                key={`hn-${i}`}
                style={{ cursor: onHistoryNodeClick && !isLast ? "pointer" : "default" }}
                onMouseEnter={(e) => show(h.fen, h.san, null, divergedPct, e)}
                onMouseLeave={hide}
                onClick={() => { if (!isLast) onHistoryNodeClick?.(fIdx); }}
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
            <text x={curX + 20} y={CY + 4} fontSize={11} fill="var(--text-muted)" opacity={0.35}>
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
