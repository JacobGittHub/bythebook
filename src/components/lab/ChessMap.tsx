"use client";

import { useRef, useEffect, useMemo, useCallback, type RefObject } from "react";
import type { LabStatValues } from "@/components/lab/LabStats";
import { buildDefaultCatalogTree } from "@/lib/chess/openingCatalog";
import type { MoveNode } from "@/types/chess";

// ── Public config ──────────────────────────────────────────────────────────────

export type ChessMapConfig = {
  maxNodes: number;          // target visible nodes at scale=1 (LOD base)
  baseBranchLength: number;
  depthDecay: number;
  retrogradeStrength: number;
  lineWidthMax: number;
  showGhostLines: boolean;
};

// ── Internal layout type ───────────────────────────────────────────────────────

type MapEdge = {
  x0: number; y0: number;
  x1: number; y1: number;
  angle: number;
  weight: number;
  lineWidth: number;
  san: string | null;
  depth: number;
  children: MapEdge[];
  isLeaf: boolean;
};

type LayoutResult = {
  edges: MapEdge[];
  lodBaseThreshold: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function compassDir(angle: number): [number, number] {
  return [Math.sin(angle), -Math.cos(angle)];
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}

// ── Weight map ─────────────────────────────────────────────────────────────────

function buildWeightMap(node: MoveNode, out: Map<string, number>): number {
  let w = 1;
  for (const c of node.children) w += buildWeightMap(c, out);
  out.set(node.id, w);
  return w;
}

// ── Major opening detection ────────────────────────────────────────────────────

function detectMajorCount(sorted: MoveNode[], weightMap: Map<string, number>): number {
  if (sorted.length <= 2) return sorted.length;
  const weights = sorted.map(c => weightMap.get(c.id) ?? 1);
  let maxDrop = 0;
  let splitAt = 1;
  const limit = Math.min(weights.length - 1, 8);
  for (let i = 1; i <= limit; i++) {
    const drop = (weights[i - 1] - weights[i]) / weights[i - 1];
    if (drop > maxDrop) { maxDrop = drop; splitAt = i; }
  }
  return maxDrop >= 0.3 ? splitAt : Math.min(4, sorted.length);
}

// ── Recursive layout ───────────────────────────────────────────────────────────
//
// sectorAngle guides how wide this subtree spreads (children are distributed
// proportionally within it). No hard walls — depth decay + retrograde naturally
// keep branches from straying far into adjacent sectors.

function layoutChildren(
  children: MoveNode[],
  x0: number,
  y0: number,
  parentAngle: number,
  sectorAngle: number,
  depth: number,
  weightMap: Map<string, number>,
  globalMax: number,
  config: ChessMapConfig,
): MapEdge[] {
  if (!children.length) return [];

  const totalW = children.reduce((s, c) => s + (weightMap.get(c.id) ?? 1), 0);
  const sorted = [...children].sort(
    (a, b) => (weightMap.get(b.id) ?? 1) - (weightMap.get(a.id) ?? 1),
  );
  const sectorSizes = sorted.map(c => (weightMap.get(c.id) ?? 1) / totalW * sectorAngle);

  // Symmetric placement: heaviest child centered on parentAngle, others alternate L/R.
  const centers = new Array<number>(sorted.length);
  centers[0] = parentAngle;
  let leftCursor = sectorSizes[0] / 2;
  let rightCursor = sectorSizes[0] / 2;
  for (let i = 1; i < sorted.length; i++) {
    const half = sectorSizes[i] / 2;
    if (i % 2 === 1) {
      centers[i] = parentAngle - leftCursor - half;
      leftCursor += sectorSizes[i];
    } else {
      centers[i] = parentAngle + rightCursor + half;
      rightCursor += sectorSizes[i];
    }
  }

  const edges: MapEdge[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i];
    const cW = weightMap.get(child.id) ?? 1;
    const cPop = cW / totalW;
    const cSector = sectorSizes[i];

    // Retrograde: blend each branch toward parentAngle+π; symmetric placement
    // ensures left branches fold left-back and right branches fold right-back.
    const rankFrac = i / Math.max(sorted.length - 1, 1);
    const retroFrac = config.retrogradeStrength * rankFrac * (1 - cPop);
    const cAngle = lerpAngle(centers[i], parentAngle + Math.PI, retroFrac);

    // Non-linear depth decay: depth×1.5 exponent makes early levels drop fast.
    // Popularity scaling gives important branches more reach within their sector.
    const lenScale = 0.2 + 0.8 * Math.pow(cPop, 0.4);
    const branchLength = config.baseBranchLength * Math.pow(config.depthDecay, depth * 1.5) * lenScale;

    const [dx, dy] = compassDir(cAngle);
    const x1 = x0 + dx * branchLength;
    const y1 = y0 + dy * branchLength;
    const lineWidth = Math.max(0.4, config.lineWidthMax * Math.pow(cW / globalMax, 0.38));

    const grandchildren = layoutChildren(
      child.children, x1, y1, cAngle, cSector,
      depth + 1, weightMap, globalMax, config,
    );

    edges.push({
      x0, y0, x1, y1,
      angle: cAngle, weight: cW, lineWidth,
      san: child.san, depth,
      children: grandchildren,
      isLeaf: grandchildren.length === 0,
    });
  }
  return edges;
}

// ── Root layout ────────────────────────────────────────────────────────────────
//
// Major openings (auto-detected by weight gap) are placed at evenly-spaced
// angles so they spread around the full circle regardless of subtree weight.
// e4 is always pinned to north. Minor openings fill the angular gaps between
// consecutive major spokes, distributed evenly within each gap zone.
//
// Each opening's subtree sectorAngle = its full slot (majorStep for majors,
// slot width for minors). No hard angular walls — the subtree spreading is just
// a guide; depth decay prevents long excursions into neighbouring sectors.

function buildLayout(config: ChessMapConfig): LayoutResult {
  const root = buildDefaultCatalogTree();
  const weightMap = new Map<string, number>();
  buildWeightMap(root, weightMap);
  const globalMax = weightMap.get(root.id) ?? 1;
  const totalChildW = root.children.reduce((s, c) => s + (weightMap.get(c.id) ?? 1), 0);

  const sorted = [...root.children].sort(
    (a, b) => (weightMap.get(b.id) ?? 1) - (weightMap.get(a.id) ?? 1),
  );

  // LOD threshold: weight of the (maxNodes)th node when all nodes sorted desc.
  // Index 0 = root (skip), so we use index = maxNodes to get threshold for N visible nodes.
  const allW = [...weightMap.values()].sort((a, b) => b - a);
  const lodBaseThreshold = allW[Math.min(config.maxNodes, allW.length - 1)] ?? 1;

  // Auto-detect major vs minor split.
  const nMajor = detectMajorCount(sorted, weightMap);
  const majors = sorted.slice(0, nMajor);
  const minors = sorted.slice(nMajor);

  // Evenly-spaced angles for majors, e4 pinned to north (0 radians).
  const e4Slot = Math.max(0, majors.findIndex(m => m.san === "e4"));
  const majorStep = (2 * Math.PI) / nMajor;
  const rotation = -e4Slot * majorStep;

  // Each major's subtree sectorAngle = its full even slot.
  // This is a spread guide, not a wall — deep-decay branches won't escape far.
  const majorSectorAngle = majorStep;

  // Distribute minors round-robin across the N gap zones (one gap per major pair).
  const minorGroups: MoveNode[][] = Array.from({ length: nMajor }, () => []);
  for (let i = 0; i < minors.length; i++) minorGroups[i % nMajor].push(minors[i]);

  const edges: MapEdge[] = [];

  for (let k = 0; k < nMajor; k++) {
    const majorAngle = rotation + k * majorStep;
    const major = majors[k];
    const cW = weightMap.get(major.id) ?? 1;
    const cPop = cW / totalChildW;
    const lenScale = 0.2 + 0.8 * Math.pow(cPop, 0.4);
    const branchLength = config.baseBranchLength * lenScale;
    const [dx, dy] = compassDir(majorAngle);
    const x1 = dx * branchLength;
    const y1 = dy * branchLength;
    const lineWidth = Math.max(0.4, config.lineWidthMax * Math.pow(cW / globalMax, 0.38));

    const children = layoutChildren(
      major.children, x1, y1, majorAngle,
      majorSectorAngle,
      1, weightMap, globalMax, config,
    );
    edges.push({
      x0: 0, y0: 0, x1, y1,
      angle: majorAngle, weight: cW, lineWidth,
      san: major.san, depth: 0,
      children, isLeaf: children.length === 0,
    });

    // Minor openings in the gap between this major and the next.
    const group = minorGroups[k];
    if (!group.length) continue;

    // Gap: centre of this major → centre of next major, minus the sector half-widths.
    // We give each minor its own slot within the gap.
    const gapStart = majorAngle + majorSectorAngle / 2;
    let gapEnd = (rotation + ((k + 1) % nMajor) * majorStep) - majorSectorAngle / 2;
    if (gapEnd <= gapStart) gapEnd += 2 * Math.PI;
    const gapSize = gapEnd - gapStart;
    const slotSize = gapSize / group.length;

    for (let j = 0; j < group.length; j++) {
      const minor = group[j];
      const mW = weightMap.get(minor.id) ?? 1;
      const mPop = mW / totalChildW;
      const mLenScale = 0.2 + 0.8 * Math.pow(mPop, 0.4);
      // Minor openings get a shorter root branch (like a depth-1 branch).
      const mBranchLength = config.baseBranchLength * Math.pow(config.depthDecay, 1.5) * mLenScale;
      const minorAngle = gapStart + slotSize * (j + 0.5);
      const [mdx, mdy] = compassDir(minorAngle);
      const mx1 = mdx * mBranchLength;
      const my1 = mdy * mBranchLength;
      const mLineWidth = Math.max(0.4, config.lineWidthMax * Math.pow(mW / globalMax, 0.38));

      // Minor subtrees start at depth 2 so all their branches are compact.
      const mChildren = layoutChildren(
        minor.children, mx1, my1, minorAngle,
        slotSize,
        2, weightMap, globalMax, config,
      );
      edges.push({
        x0: 0, y0: 0, x1: mx1, y1: my1,
        angle: minorAngle, weight: mW, lineWidth: mLineWidth,
        san: minor.san, depth: 0,
        children: mChildren, isLeaf: mChildren.length === 0,
      });
    }
  }

  return { edges, lodBaseThreshold };
}

// ── Drawing ────────────────────────────────────────────────────────────────────

const GHOST_LENGTH = 28;
const GHOST_DASH: number[] = [3, 5];

type WorldBounds = { left: number; right: number; top: number; bottom: number };

function isOffScreen(
  x0: number, y0: number, x1: number, y1: number, wb: WorldBounds,
): boolean {
  return (
    (x0 < wb.left   && x1 < wb.left)   ||
    (x0 > wb.right  && x1 > wb.right)  ||
    (y0 < wb.top    && y1 < wb.top)    ||
    (y0 > wb.bottom && y1 > wb.bottom)
  );
}

function drawEdgesRecursive(
  ctx: CanvasRenderingContext2D,
  edges: MapEdge[],
  showGhost: boolean,
  lodThreshold: number,
  wb: WorldBounds,
) {
  for (const e of edges) {
    if (e.weight < lodThreshold) continue;

    if (!isOffScreen(e.x0, e.y0, e.x1, e.y1, wb)) {
      ctx.beginPath();
      ctx.lineWidth = e.lineWidth;
      const alpha = Math.max(0.12, 0.9 - e.depth * 0.12);
      ctx.strokeStyle = `rgba(160, 205, 255, ${alpha})`;
      ctx.moveTo(e.x0, e.y0);
      ctx.lineTo(e.x1, e.y1);
      ctx.stroke();

      if (showGhost && e.isLeaf) {
        const [gdx, gdy] = compassDir(e.angle);
        ctx.beginPath();
        ctx.lineWidth = Math.max(0.3, e.lineWidth * 0.35);
        ctx.strokeStyle = `rgba(160, 205, 255, 0.18)`;
        ctx.setLineDash(GHOST_DASH);
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x1 + gdx * GHOST_LENGTH, e.y1 + gdy * GHOST_LENGTH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (e.children.length) drawEdgesRecursive(ctx, e.children, showGhost, lodThreshold, wb);
  }
}

/** Draws the node dots and returns how many it drew. */
function drawNodesRecursive(
  ctx: CanvasRenderingContext2D,
  edges: MapEdge[],
  baseRadius: number,
  lodThreshold: number,
  wb: WorldBounds,
): number {
  let drawn = 0;
  for (const e of edges) {
    if (e.weight < lodThreshold) continue;

    if (!isOffScreen(e.x1, e.y1, e.x1, e.y1, wb)) {
      const r = Math.max(0.6, baseRadius * Math.pow(0.88, e.depth));
      ctx.beginPath();
      ctx.arc(e.x1, e.y1, r, 0, Math.PI * 2);
      ctx.fillStyle = e.isLeaf ? `rgba(100, 160, 255, 0.55)` : `rgba(180, 215, 255, 0.8)`;
      ctx.fill();
      drawn++;
    }

    if (e.children.length) drawn += drawNodesRecursive(ctx, e.children, baseRadius, lodThreshold, wb);
  }
  return drawn;
}

/** The stretch of time the FPS figure is averaged over. */
const FPS_WINDOW_MS = 500;

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChessMap({
  config,
  statsRef,
}: {
  config: ChessMapConfig;
  /** Where the map reports its FPS and the nodes it drew. */
  statsRef?: RefObject<LabStatValues>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const txRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const rafRef = useRef<number>(0);
  const dirtyRef = useRef(true);

  const layoutResult = useMemo(
    () => buildLayout(config),
    // showGhostLines is draw-only; maxNodes only affects lodBaseThreshold (inside buildLayout).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.maxNodes, config.depthDecay, config.baseBranchLength, config.retrogradeStrength, config.lineWidthMax],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { x, y, scale } = txRef.current;

    ctx.clearRect(0, 0, W, H);

    // HSL conic gradient anchored to root position so the colour wheel always
    // matches the compass directions of the opening sectors.
    const grad = ctx.createConicGradient(-Math.PI / 2, x, y);
    for (let i = 0; i <= 12; i++) {
      grad.addColorStop(i / 12, `hsla(${(i * 30) % 360}, 65%, 55%, 0.085)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // World-space viewport with generous margin so edges entering from off-screen
    // still draw completely.
    const margin = config.baseBranchLength * 0.5;
    const wb: WorldBounds = {
      left:   (-x / scale) - margin,
      right:  ((W - x) / scale) + margin,
      top:    (-y / scale) - margin,
      bottom: ((H - y) / scale) + margin,
    };

    // LOD: threshold shrinks as scale grows → deeper nodes revealed on zoom-in.
    const lodThreshold = layoutResult.lodBaseThreshold / scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    drawEdgesRecursive(ctx, layoutResult.edges, config.showGhostLines, lodThreshold, wb);

    const baseNodeRadius = 3.5 / scale;
    const nodesDrawn = drawNodesRecursive(ctx, layoutResult.edges, baseNodeRadius, lodThreshold, wb);
    // The root's dot, drawn below, counts too.
    if (statsRef?.current) statsRef.current.nodes = nodesDrawn + 1;

    // Root node
    ctx.beginPath();
    ctx.arc(0, 0, 5 / scale, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = "#34d399";
    ctx.stroke();

    ctx.restore();
  }, [layoutResult, config.showGhostLines, config.baseBranchLength, statsRef]);

  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    function loop(now: number) {
      // The loop runs every frame and redraws only when something changed, so its own rate
      // is the frame rate.
      frames++;
      if (now - since >= FPS_WINDOW_MS) {
        if (statsRef?.current) statsRef.current.fps = (frames * 1000) / (now - since);
        frames = 0;
        since = now;
      }
      if (dirtyRef.current) { render(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render, statsRef]);

  useEffect(() => { dirtyRef.current = true; }, [layoutResult, config.showGhostLines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centered = { done: false };
    const obs = new ResizeObserver(([entry]) => {
      canvas.width = entry.contentRect.width;
      canvas.height = entry.contentRect.height;
      if (!centered.done) {
        txRef.current = { x: canvas.width / 2, y: canvas.height / 2, scale: 1 };
        centered.done = true;
      }
      dirtyRef.current = true;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const { x, y, scale } = txRef.current;
    txRef.current = {
      scale: Math.max(0.04, Math.min(400, scale * factor)),
      x: mx + (x - mx) * factor,
      y: my + (y - my) * factor,
    };
    dirtyRef.current = true;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx: txRef.current.x, ty: txRef.current.y };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    txRef.current.x = dragRef.current.tx + (e.clientX - dragRef.current.sx);
    txRef.current.y = dragRef.current.ty + (e.clientY - dragRef.current.sy);
    dirtyRef.current = true;
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      style={{ background: "#07080f" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}
