"use client";

import { useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { MoveNode } from "@/types/chess";

// ── Layout constants ──────────────────────────────────────────────────────────

const VB = 500;            // viewBox: -250..250 in both axes
const HALF = VB / 2;
const PER_DEPTH_R = 60;   // viewBox units per depth level (depth 1 = 60, depth 5 = 300)
const NODE_R = 7;
const ROOT_R = 12;
const GHOST_R = 5;
const GRID_SPACING = 25;  // viewBox units between grid dots

// ── Types ─────────────────────────────────────────────────────────────────────

export type DisplayNode = MoveNode & { isGhost?: boolean };

export type SelectedNodeInfo = {
  id: string;
  node: DisplayNode;
  pathMoves: { san: string; uci: string; fen: string }[];
};

type Props = {
  moveNode: MoveNode | null;
  ghostExpansions: Map<string, DisplayNode[]>;
  selectedNodeId: string | null;
  highlightIds?: Set<string>;
  bookFens?: Set<string>;
  onNodeSelect: (info: SelectedNodeInfo) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDisplayTree(node: MoveNode, ghosts: Map<string, DisplayNode[]>): DisplayNode {
  const ghostChildren = (ghosts.get(node.id) ?? []).map(
    (g): DisplayNode => ({ ...g, isGhost: true, children: [] }),
  );
  return {
    ...node,
    children: [
      ...node.children.map((c) => buildDisplayTree(c, ghosts)),
      ...ghostChildren,
    ],
  };
}

function radialPoint(angle: number, r: number): [number, number] {
  return [r * Math.cos(angle - Math.PI / 2), r * Math.sin(angle - Math.PI / 2)];
}

// Smooth radial link: cubic bezier pulling the midpoint toward the center arc
function linkPath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) * 0.5;
  const my = (sy + ty) * 0.5;
  // Pull control point slightly toward origin for a gentle curve
  return `M${sx},${sy} Q${mx * 0.55},${my * 0.55} ${tx},${ty}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OpeningTreeFull({
  moveNode,
  ghostExpansions,
  selectedNodeId,
  highlightIds = new Set(),
  bookFens = new Set(),
  onNodeSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Store drag origin in a ref to avoid stale closures and unnecessary re-renders
  const dragOrigin = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Build display tree (merge ghost expansions) ──────────────────────────

  const displayTree = useMemo(
    () => (moveNode ? buildDisplayTree(moveNode, ghostExpansions) : null),
    [moveNode, ghostExpansions],
  );

  // ── D3 layout: angular positions from d3.tree, radial depth fixed per level ─

  const treeData = useMemo(() => {
    if (!displayTree) return null;

    const root = d3.hierarchy<DisplayNode>(
      displayTree,
      (d) => (d.children.length > 0 ? d.children : null),
    );

    const layout = d3
      .tree<DisplayNode>()
      .size([2 * Math.PI, 1]) // radius=1 placeholder — we override .y below
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth));

    const positioned = layout(root) as d3.HierarchyPointNode<DisplayNode>;

    // Override each node's radial distance to a fixed multiple of depth
    positioned.each((n) => {
      n.y = n.depth * PER_DEPTH_R;
    });

    return positioned;
  }, [displayTree]);

  // ── Selected-path ancestors ──────────────────────────────────────────────

  const selectedAncestorIds = useMemo<Set<string>>(() => {
    if (!treeData || !selectedNodeId) return new Set();
    const found = treeData.descendants().find((n) => n.data.id === selectedNodeId);
    if (!found) return new Set();
    return new Set(found.ancestors().map((n) => n.data.id));
  }, [treeData, selectedNodeId]);

  // ── Pan / drag handlers ──────────────────────────────────────────────────

  const screenToVB = (): number => {
    if (!svgRef.current) return 1;
    const { width, height } = svgRef.current.getBoundingClientRect();
    return Math.min(width, height) / VB; // px per viewBox unit
  };

  const onMouseDown = (e: React.MouseEvent) => {
    // Only start drag on primary button
    if (e.button !== 0) return;
    dragOrigin.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
    setIsDragging(true);
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.sx;
    const dy = e.clientY - dragOrigin.current.sy;
    if (!dragOrigin.current.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragOrigin.current.moved = true;
    }
    if (dragOrigin.current.moved) {
      const scale = screenToVB();
      setPan({ x: dragOrigin.current.px + dx / scale, y: dragOrigin.current.py + dy / scale });
    }
  };

  const onMouseUp = () => {
    dragOrigin.current = null;
    setIsDragging(false);
  };

  // ── Node click (only fires when mouse didn't move) ───────────────────────

  const handleNodeClick = (node: d3.HierarchyPointNode<DisplayNode>) => {
    if (dragOrigin.current?.moved) return;
    const pathMoves = node
      .ancestors()
      .reverse()
      .slice(1)
      .map((n) => ({ san: n.data.san!, uci: n.data.uci!, fen: n.data.fen }));
    onNodeSelect({ id: node.data.id, node: node.data, pathMoves });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!treeData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)] opacity-50">
        Loading tree…
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={svgRef}
        viewBox={`-${HALF} -${HALF} ${VB} ${VB}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <defs>
          <pattern
            id="tree-grid"
            x="0" y="0"
            width={GRID_SPACING} height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={GRID_SPACING / 2} cy={GRID_SPACING / 2} r="0.8" fill="var(--border-card)" opacity="0.5" />
          </pattern>
        </defs>

        {/* Fixed grid background — outside the pan group so it stays stationary */}
        <rect
          x={-HALF} y={-HALF} width={VB} height={VB}
          fill="url(#tree-grid)"
          style={{ pointerEvents: "none" }}
        />

        {/* Pan group — translate entire tree content */}
        <g transform={`translate(${pan.x},${pan.y})`}>

          {/* ── Edges ── */}
          <g>
            {treeData.links().map((link) => {
              const src = link.source as d3.HierarchyPointNode<DisplayNode>;
              const tgt = link.target as d3.HierarchyPointNode<DisplayNode>;
              const [sx, sy] = src.depth === 0 ? [0, 0] : radialPoint(src.x, src.y);
              const [tx, ty] = radialPoint(tgt.x, tgt.y);
              const onPath = selectedAncestorIds.has(tgt.data.id);
              const isGhost = Boolean(tgt.data.isGhost);
              const isHighlight = highlightIds.has(tgt.data.id);
              const inBook = bookFens.has(tgt.data.fen);

              return (
                <path
                  key={`e-${tgt.data.id}`}
                  d={linkPath(sx, sy, tx, ty)}
                  fill="none"
                  stroke={
                    onPath      ? "var(--text-primary)"
                    : isHighlight ? "#6366f1"
                    : inBook    ? "#059669"
                    : "var(--border-card)"
                  }
                  strokeWidth={onPath ? 3.5 : isGhost ? 1.5 : 2}
                  strokeOpacity={isGhost ? 0.3 : onPath ? 1 : inBook ? 0.75 : 0.55}
                  strokeDasharray={isGhost ? "3 3" : undefined}
                />
              );
            })}
          </g>

          {/* ── Labels ── */}
          <g aria-hidden="true" style={{ pointerEvents: "none" }}>
            {treeData.descendants().filter((n) => n.depth > 0 && n.data.san).map((n) => {
              const node = n as d3.HierarchyPointNode<DisplayNode>;
              const angleDeg = node.x * 180 / Math.PI;
              const flip = node.x > Math.PI;
              const offset = (node.data.isGhost ? GHOST_R : NODE_R) + 6;
              const onPath = selectedAncestorIds.has(node.data.id);
              const isHighlight = highlightIds.has(node.data.id);
              const inBook = bookFens.has(node.data.fen);

              return (
                <text
                  key={`l-${node.data.id}`}
                  transform={`rotate(${angleDeg - 90}) translate(${node.y + offset},0) rotate(${flip ? 180 : 0})`}
                  textAnchor={flip ? "end" : "start"}
                  fontSize={10}
                  fill={
                    onPath      ? "var(--text-primary)"
                    : isHighlight ? "#6366f1"
                    : inBook    ? "#059669"
                    : "var(--text-muted)"
                  }
                  fontWeight={onPath || isHighlight || inBook ? "600" : "400"}
                  opacity={node.data.isGhost ? 0.5 : 1}
                  style={{ userSelect: "none" }}
                >
                  {node.data.san}
                </text>
              );
            })}
          </g>

          {/* ── Nodes ── */}
          <g>
            {treeData.descendants().map((n) => {
              const node = n as d3.HierarchyPointNode<DisplayNode>;
              const [nx, ny] = node.depth === 0 ? [0, 0] : radialPoint(node.x, node.y);
              const isRoot = node.depth === 0;
              const isGhost = Boolean(node.data.isGhost);
              const isSelected = node.data.id === selectedNodeId;
              const onPath = selectedAncestorIds.has(node.data.id);
              const isHighlight = highlightIds.has(node.data.id);
              const inBook = !isRoot && bookFens.has(node.data.fen);
              const r = isRoot ? ROOT_R : isGhost ? GHOST_R : NODE_R;

              const fill = isGhost       ? "var(--bg-card)"
                         : onPath        ? "var(--text-primary)"
                         : inBook        ? "#059669"
                         : isHighlight   ? "#6366f1"
                         : "var(--bg-muted)";

              const stroke = isGhost     ? "var(--border-card)"
                           : onPath      ? "var(--text-primary)"
                           : inBook      ? "#059669"
                           : isHighlight ? "#6366f1"
                           : "var(--border-card)";

              return (
                <g
                  key={`n-${node.data.id}`}
                  transform={`translate(${nx},${ny})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleNodeClick(node)}
                >
                  {isSelected && (
                    <circle r={r + 5} fill="none" stroke="var(--text-primary)" strokeWidth={2} opacity={0.35} />
                  )}
                  <circle
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isGhost ? 1 : 1.5}
                    strokeDasharray={isGhost ? "2 2" : undefined}
                    opacity={isGhost ? 0.5 : 1}
                  />
                  {isRoot && (
                    <text
                      y={ROOT_R + 13}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--text-muted)"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      Start
                    </text>
                  )}
                </g>
              );
            })}
          </g>

        </g>
      </svg>
    </div>
  );
}
