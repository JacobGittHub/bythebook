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
const MAX_ALTS = 6;
const ALT_Y_OFF = 32;

const VB_H = 200;
const CY = VB_H / 2;  // 100

const CHAIN_X_START = 28;  // x position of the start/root node
const NODE_STEP = 56;
const ALT_GAP = 8;           // pixels between an alt circle and the history node it belongs to
const CONT_OFFSET = 120;
const TOOLTIP_W = 144;

// Node radii
const HIST_R = 5;   // regular history nodes
const CURR_R = 7;   // current position (last history node)
const START_R = 5;  // start node
const CONT_R = 5;   // continuation nodes
const ALT_R = 4;    // alternate nodes

// Node fill colors for white/black moves
const WHITE_MOVE_FILL   = "rgba(235, 229, 218, 0.95)";
const WHITE_MOVE_STROKE = "rgba(165, 155, 138, 0.85)";
const BLACK_MOVE_FILL   = "rgba(36, 32, 28, 0.95)";
const BLACK_MOVE_STROKE = "rgba(90, 82, 72, 0.85)";

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

// ── Edge-width formula ──────────────────────────────────────────────────────

const GAMES_KNEE = 50_000;
const GAMES_SAT  = 2_000_000;
const MIN_W = 1.2;
const MAX_W = 6.7;
const MID_W = MIN_W + 0.6 * (MAX_W - MIN_W);

const calcEdgeWidth = (games: number | null): number => {
  if (games === null || games <= 0) return MIN_W;
  if (games < GAMES_KNEE) return MIN_W + (games / GAMES_KNEE) * (MID_W - MIN_W);
  return MID_W + Math.min((games - GAMES_KNEE) / (GAMES_SAT - GAMES_KNEE), 1) * (MAX_W - MID_W);
};

// ── Alt label positions ─────────────────────────────────────────────────────

const altSanLabelY = (y: number): number => (y >= CY ? y + 13 : y - 10);
const altPctLabelY = (y: number): number => (y >= CY ? y + 22 : y - 19);

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

  // Auto-scroll to current node when history grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moveHistory.length]);

  // Compute FEN after each continuation move
  const contFens = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of topMoves) {
      try {
        const chess = new Chess(currentFen);
        const r = chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
        if (r) map[m.uci] = chess.fen();
      } catch { /* skip */ }
    }
    return map;
  }, [currentFen, topMoves]);

  // Compute FEN after each alternate move
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
          const r = chess.move({ from: alt.uci.slice(0, 2), to: alt.uci.slice(2, 4), promotion: alt.uci[4] });
          if (r) map[`${fIdx}-${alt.uci}`] = chess.fen();
        } catch { /* skip */ }
      }
    }
    return map;
  }, [moveHistory, historyAlternates]);

  // ── Layout ────────────────────────────────────────────────────────────────

  // The START node sits at CHAIN_X_START.
  // History nodes are shifted one step right: histXs[i] = CHAIN_X_START + (i+1)*NODE_STEP
  // Alternates for history[i] branch from CHAIN_X_START + i*NODE_STEP (= altBaseX(i))
  //   which equals startX for i=0, and histXs[i-1] for i>0.
  const startX = CHAIN_X_START;
  const histXs = visibleHistory.map((_, i) => CHAIN_X_START + (i + 1) * NODE_STEP);
  const altBaseX = (i: number) => CHAIN_X_START + i * NODE_STEP;

  // The LAST history node IS the current position node (no separate curX).
  const curX = visibleHistory.length > 0 ? histXs[visibleHistory.length - 1] : startX;
  const contX = curX + CONT_OFFSET;
  const svgWidth = Math.max(hasCont ? contX + 40 : curX + 40, 200);

  const contYs: number[] = useMemo(() => {
    if (topMoves.length === 0) return [];
    if (topMoves.length === 1) return [CY];
    if (topMoves.length === 2) return [CY - 38, CY + 38];
    return [CY - 52, CY, CY + 52];
  }, [topMoves.length]);

  const contEdgeWidth = (m: ExplorerMove) => calcEdgeWidth(m.white + m.draws + m.black);

  // Alts are placed at histXs[i] - ALT_GAP so they sit just left of the node they branch from
  const altPositions = (histX: number, count: number): { x: number; y: number }[] => {
    const altX = histX - ALT_GAP;
    if (count === 0) return [];
    if (count === 1) return [{ x: altX, y: CY - ALT_Y_OFF }];
    if (count === 2) return [{ x: altX, y: CY - ALT_Y_OFF }, { x: altX, y: CY + ALT_Y_OFF }];
    // 3+ alts: evenly distribute across available height
    const spacing = Math.min(26, (VB_H - 40) / (count - 1));
    const totalH = (count - 1) * spacing;
    const startY = CY - totalH / 2;
    return Array.from({ length: count }, (_, k) => ({ x: altX, y: startY + k * spacing }));
  };

  // FEN that the start node represents (position before the first visible move)
  const startFen = fractionOffset === 0 ? START_FEN : moveHistory[fractionOffset - 1].fen;

  const show = (fen: string, san: string | null, move: ExplorerMove | null, divergedPct: number | null, e: React.MouseEvent) =>
    setTooltip({ fen, san, move, divergedPct, mouseX: e.clientX, mouseY: e.clientY });
  const hide = () => setTooltip(null);

  return (
    <>
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
            <text x={startX - 14} y={CY + 4} fontSize={11} fill="var(--text-muted)" opacity={0.35} textAnchor="middle">···</text>
          )}

          {/* ── Edges ─────────────────────────────────────────────────── */}

          {/* History edges: edge[i] goes from the previous position to histXs[i] */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const x1 = i === 0 ? startX : histXs[i - 1];
            const x2 = histXs[i];
            return (
              <line
                key={`he-${i}`}
                x1={x1} y1={CY} x2={x2} y2={CY}
                stroke="var(--border-card)"
                strokeWidth={calcEdgeWidth(historyPlayedGames?.[fIdx] ?? null)}
              />
            );
          })}

          {/* Alternate edges: start at altBaseX(i), tip near histXs[i] */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const entry = historyAlternates?.[fIdx];
            if (!entry) return null;
            const alts = entry.alts.slice(0, MAX_ALTS);
            const bx = altBaseX(i);
            const positions = altPositions(histXs[i], alts.length);
            return alts.map((alt, j) => (
              <line
                key={`ae-${fIdx}-${alt.uci}`}
                x1={bx} y1={CY}
                x2={positions[j].x} y2={positions[j].y}
                stroke="var(--text-muted)"
                strokeWidth={calcEdgeWidth(alt.white + alt.draws + alt.black)}
                strokeOpacity={0.4}
                strokeLinecap="round"
              />
            ));
          })}

          {/* Continuation edges from current (last history or start) */}
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

          {/* ── Nodes ─────────────────────────────────────────────────── */}

          {/* Alternate nodes — tips near histXs[i] */}
          {visibleHistory.map((_, i) => {
            const fIdx = fractionOffset + i;
            const entry = historyAlternates?.[fIdx];
            if (!entry) return null;
            const alts = entry.alts.slice(0, MAX_ALTS);
            const positions = altPositions(histXs[i], alts.length);
            // Alternates are played by the same color as the actual move at fIdx
            const isWhiteAlt = fIdx % 2 === 0;
            const altFill = isWhiteAlt ? WHITE_MOVE_FILL : BLACK_MOVE_FILL;
            const altStroke = isWhiteAlt ? WHITE_MOVE_STROKE : BLACK_MOVE_STROKE;
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
                  <circle cx={pos.x} cy={pos.y} r={ALT_R} fill={altFill} stroke={altStroke} strokeWidth={1.2} strokeDasharray="2 2" />
                  <text x={pos.x} y={altSanLabelY(pos.y)} textAnchor="middle" fontSize={7.5} fill="var(--text-muted)" opacity={0.8}>{alt.san}</text>
                  <text x={pos.x} y={altPctLabelY(pos.y)} textAnchor="middle" fontSize={7} fill="var(--text-muted)" opacity={0.6}>{pct}%</text>
                </g>
              );
            });
          })}

          {/* History nodes — colored by whose move it was, % label below */}
          {visibleHistory.map((h, i) => {
            const fIdx = fractionOffset + i;
            const fraction = historyPlayedFractions?.[fIdx] ?? null;
            const divergedPct = fraction !== null ? 1 - fraction : null;
            const isCurrentNode = i === visibleHistory.length - 1; // last = current position
            const isWhite = h.color === "w";
            const r = isCurrentNode ? CURR_R : HIST_R;
            const fill = isCurrentNode
              ? "var(--bg-sidebar)"
              : isWhite ? WHITE_MOVE_FILL : BLACK_MOVE_FILL;
            const stroke = isCurrentNode
              ? "var(--border-card)"
              : isWhite ? WHITE_MOVE_STROKE : BLACK_MOVE_STROKE;

            return (
              <g
                key={`hn-${i}`}
                style={{ cursor: onHistoryNodeClick && !isCurrentNode ? "pointer" : "default" }}
                onMouseEnter={(e) => show(h.fen, h.san, null, divergedPct, e)}
                onMouseLeave={hide}
                onClick={() => { if (!isCurrentNode) onHistoryNodeClick?.(fIdx); }}
              >
                {/* Ring on current node */}
                {isCurrentNode && (
                  <circle cx={histXs[i]} cy={CY} r={r + 3} fill="none" stroke="var(--border-card)" strokeWidth={1} opacity={0.4} />
                )}
                <circle cx={histXs[i]} cy={CY} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
                {/* SAN label above */}
                <text x={histXs[i]} y={CY - r - 5} textAnchor="middle" fontSize={7.5} fill="var(--text-muted)">
                  {h.san}
                </text>
                {/* % of players who took this path — below node */}
                {fraction !== null && (
                  <text x={histXs[i]} y={CY + r + 10} textAnchor="middle" fontSize={6.5} fill="var(--text-muted)" opacity={0.55}>
                    {Math.round(fraction * 100)}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Start node — unlabeled, always rendered */}
          <g
            onMouseEnter={(e) => show(startFen, null, null, null, e)}
            onMouseLeave={hide}
          >
            <circle cx={startX} cy={CY} r={START_R} fill="var(--bg-muted)" stroke="var(--border-card)" strokeWidth={1.5} />
          </g>

          {/* No-data indicator */}
          {!hasCont && (
            <text x={curX + 20} y={CY + 4} fontSize={11} fill="var(--text-muted)" opacity={0.35}>···</text>
          )}

          {/* Continuation nodes */}
          {topMoves.map((m, i) => {
            const isHov = hoveredUci === m.uci;
            return (
              <g
                key={`cn-${m.uci}`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => { onHoverUci(m.uci); show(contFens[m.uci] ?? currentFen, m.san, m, null, e); }}
                onMouseLeave={() => { onHoverUci(null); hide(); }}
                onClick={() => onMoveClick(m)}
              >
                <circle
                  cx={contX} cy={contYs[i]} r={CONT_R}
                  fill={isHov ? "var(--bg-muted)" : "var(--bg-card)"}
                  stroke={isHov ? "var(--text-primary)" : "var(--border-card)"}
                  strokeWidth={1.5}
                />
                <text x={contX} y={contYs[i] - 9} textAnchor="middle" fontSize={7.5}
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

      {tooltip && <MiniTreeTooltip tooltip={tooltip} boardOrientation={boardOrientation} />}
    </>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

function MiniTreeTooltip({ tooltip, boardOrientation }: { tooltip: TooltipData; boardOrientation: "white" | "black" }) {
  const openingName = getCatalogMatchesForFen(tooltip.fen, 1)[0]?.name;
  const m = tooltip.move;
  const total = m ? m.white + m.draws + m.black : 0;
  const wPct = total > 0 ? Math.round((m!.white / total) * 100) : 0;
  const dPct = total > 0 ? Math.round((m!.draws / total) * 100) : 0;
  const bPct = 100 - wPct - dPct;

  const fmtGames = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

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
        {tooltip.san && <p className="text-xs font-semibold text-slate-800">{tooltip.san}</p>}
        {openingName && <p className="truncate text-xs text-slate-500">{openingName}</p>}
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
          <p className="text-xs text-slate-400">{Math.round(tooltip.divergedPct * 100)}% chose differently</p>
        )}
      </div>
    </div>
  );
}
