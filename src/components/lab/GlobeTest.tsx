"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stats, Html, AdaptiveDpr } from "@react-three/drei";
import { Mesh, BufferGeometry, Float32BufferAttribute } from "three";
import { buildDefaultCatalogTree } from "@/lib/chess/openingCatalog";
import type { MoveNode } from "@/types/chess";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GlobeConfig = {
  nodeCount: number;
  rotateSpeed: number;
  nodeSize: number;
  depthShells: number;
  edgeOpacity: number;
  dataSource: "synthetic" | "eco";
  layout: "fibonacci" | "recursive";
  showLabels: boolean;
  buildAnim: boolean;
  buildAnimSpeed: number;    // nodes per second (3–20)
  buildAnimPriority: number; // 0 = BFS/round-robin, 1 = DFS
  engineBias: number;        // 0 = equal weight per branch, 1 = larger subtrees get more timeslices
  nodeSizeByWeight: boolean; // scale node size + edge brightness by child-count weight
  nodeEntryAnim: "none" | "scale" | "hinge" | "split";
  nodeAnimDuration: number;  // seconds for entry animation (0.1–2.0)
  edgeWeight: number;        // base edge brightness 0–1 (proxy for visual thickness)
  edgeWeightByChild: boolean; // vary brightness by child node's weight (games played proxy)
};

export type RendererStats = {
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
};

type Vec3 = [number, number, number];

type TreeNode = {
  id: number;
  position: Vec3;
  depth: number;
  parentId: number | null;
  label?: string;
  weight: number; // direct child count — proxy for games played / importance until real data available
};

// Per-node entry record: timestamp + position the animation starts FROM.
type NodeEntry = { time: number; startPos: Vec3 };

// ── Vec3 helpers ──────────────────────────────────────────────────────────────

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-9) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dist3(a: Vec3, b: Vec3): number { const d=sub3(a,b); return Math.sqrt(d[0]*d[0]+d[1]*d[1]+d[2]*d[2]); }
function dot3(a: Vec3, b: Vec3): number { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function slerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const cosA = Math.max(-1, Math.min(1, dot3(a, b)));
  const theta = Math.acos(cosA);
  if (theta < 1e-4) return normalize([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]);
  const s = Math.sin(theta);
  const wa = Math.sin((1-t)*theta)/s, wb = Math.sin(t*theta)/s;
  return [a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb];
}

function buildOrthonormalFrame(axis: Vec3): { axis: Vec3; right: Vec3; up: Vec3 } {
  const ref: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cx = axis[1] * ref[2] - axis[2] * ref[1];
  const cy = axis[2] * ref[0] - axis[0] * ref[2];
  const cz = axis[0] * ref[1] - axis[1] * ref[0];
  const right = normalize([cx, cy, cz]);
  return {
    axis,
    right,
    up: [
      axis[1] * right[2] - axis[2] * right[1],
      axis[2] * right[0] - axis[0] * right[2],
      axis[0] * right[1] - axis[1] * right[0],
    ],
  };
}

// ── Layout: Fibonacci (synthetic flat) ───────────────────────────────────────

function buildTree(nodeCount: number, depthShells: number): TreeNode[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const shellSize = Math.max(1, Math.ceil(nodeCount / depthShells));
  const nodes: TreeNode[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const depth = Math.min(Math.floor(i / shellSize), depthShells - 1);
    const localIndex = i - depth * shellSize;
    const localTotal = Math.min(shellSize, nodeCount - depth * shellSize);
    const r = 1.3 + depth * 0.65;
    const y = 1 - (localIndex / Math.max(localTotal - 1, 1)) * 2;
    const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    let parentId: number | null = null;
    if (depth > 0) {
      const prev = (depth - 1) * shellSize;
      parentId = prev + (i % Math.max(Math.min(shellSize, nodeCount - prev), 1));
    }
    nodes.push({
      id: i,
      position: [r * radiusXZ * Math.cos(theta), r * y, r * radiusXZ * Math.sin(theta)],
      depth,
      parentId,
      label: `N${i}`,
      weight: 0,
    });
  }
  return nodes;
}

// ── Layout: Fibonacci (ECO) ───────────────────────────────────────────────────

function flattenFlat(
  node: MoveNode,
  depth: number,
  parentId: number | null,
  out: TreeNode[],
  maxDepth: number
): void {
  if (depth > maxDepth) return;
  const id = out.length;
  out.push({ id, position: [0, 0, 0], depth, parentId, label: node.san ?? undefined, weight: 0 });
  for (const child of node.children) flattenFlat(child, depth + 1, id, out, maxDepth);
}

function buildEcoTree(maxDepth: number): TreeNode[] {
  const root = buildDefaultCatalogTree();
  const nodes: TreeNode[] = [];
  flattenFlat(root, 0, null, nodes, maxDepth);

  const byDepth = new Map<number, number[]>();
  nodes.forEach((n) => {
    const arr = byDepth.get(n.depth) ?? [];
    arr.push(n.id);
    byDepth.set(n.depth, arr);
  });
  const localIndexOf = new Map<number, number>();
  byDepth.forEach((ids) => ids.forEach((id, i) => localIndexOf.set(id, i)));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const actualMax = byDepth.size - 1;
  nodes.forEach((node) => {
    const li = localIndexOf.get(node.id)!;
    const lt = byDepth.get(node.depth)!.length;
    const r = 1.3 + (node.depth / Math.max(actualMax, 1)) * (maxDepth * 0.65);
    const y = 1 - (li / Math.max(lt - 1, 1)) * 2;
    const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * li;
    node.position = [r * radiusXZ * Math.cos(theta), r * y, r * radiusXZ * Math.sin(theta)];
  });
  return nodes;
}

// ── Layout: Recursive sphere-shell ───────────────────────────────────────────

function buildSyntheticMoveTree(nodeCount: number, maxDepth: number): MoveNode {
  const root: MoveNode = { id: "0", san: null, uci: null, fen: "", children: [] };
  if (nodeCount <= 1) return root;
  const branching = Math.max(2, Math.round(Math.pow(nodeCount, 1 / Math.max(1, maxDepth))));
  type Frame = { node: MoveNode; depth: number; path: string };
  const queue: Frame[] = [{ node: root, depth: 0, path: "" }];
  let nextId = 1;
  while (queue.length > 0 && nextId < nodeCount) {
    const { node, depth, path } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const n = Math.min(branching, nodeCount - nextId);
    for (let i = 0; i < n; i++) {
      const label = path ? `${path}.${i + 1}` : `${i + 1}`;
      const child: MoveNode = { id: `${nextId}`, san: label, uci: null, fen: "", children: [] };
      nextId++;
      node.children.push(child);
      queue.push({ node: child, depth: depth + 1, path: label });
      if (nextId >= nodeCount) break;
    }
  }
  return root;
}

const REC_FIRST_R = 1.7;
const REC_DECAY = 0.62;
const REC_CONE = Math.PI / 3;

function layoutRecursive(root: MoveNode, maxDepth: number): TreeNode[] {
  const out: TreeNode[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  function place(node: MoveNode, depth: number, parentId: number | null, pos: Vec3): void {
    if (depth > maxDepth + 1) return;
    let myId: number | null = null;
    if (depth > 0) {
      myId = out.length;
      out.push({ id: myId, position: pos, depth: depth - 1, parentId, label: node.san ?? undefined, weight: 0 });
    }
    if (depth > maxDepth || node.children.length === 0) return;

    const n = node.children.length;
    const childR = REC_FIRST_R * Math.pow(REC_DECAY, depth);

    if (depth === 0) {
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;
        place(node.children[i], depth + 1, myId, [r * Math.cos(theta) * childR, y * childR, r * Math.sin(theta) * childR]);
      }
      return;
    }

    const outward = normalize(pos);
    const frame = buildOrthonormalFrame(outward);
    const cone = n === 1 ? 0 : Math.min(Math.PI / 2.1, REC_CONE * Math.sqrt(n / 3));

    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2;
      const cc = Math.cos(cone), sc = Math.sin(cone), ca = Math.cos(az), sa = Math.sin(az);
      const dir: Vec3 = [
        frame.axis[0] * cc + (frame.right[0] * ca + frame.up[0] * sa) * sc,
        frame.axis[1] * cc + (frame.right[1] * ca + frame.up[1] * sa) * sc,
        frame.axis[2] * cc + (frame.right[2] * ca + frame.up[2] * sa) * sc,
      ];
      place(node.children[i], depth + 1, myId, [pos[0] + dir[0] * childR, pos[1] + dir[1] * childR, pos[2] + dir[2] * childR]);
    }
  }

  place(root, 0, null, [0, 0, 0]);
  return out;
}

// ── Build order (round-robin scheduler) ──────────────────────────────────────
// priorityBias 0 = BFS/round-robin (quantum=1), 1 = DFS (quantum=full branch)

// priorityBias: 0 = BFS/round-robin (quantum=1), 1 = DFS (quantum=full branch)
// engineBias:   0 = equal timeslices per branch, 1 = larger subtrees get proportionally more
//   Larger subtree ≈ more ECO lines run through it ≈ proxy for "stronger/more important" moves.
//   At full bias this approximates a minimax-weighted expansion: branches explored by more
//   master games (both sides' best responses) appear first.
function computeBuildOrder(nodes: TreeNode[], priorityBias: number, engineBias: number): number[] {
  if (nodes.length === 0) return [];

  const childrenOf = new Map<number | null, number[]>();
  nodes.forEach((n) => {
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n.id);
    childrenOf.set(n.parentId, list);
    if (!childrenOf.has(n.id)) childrenOf.set(n.id, []);
  });

  const rootKids = childrenOf.get(null) ?? [];
  if (rootKids.length === 0) return nodes.map((n) => n.id);

  function dfsOf(root: number): number[] {
    const result: number[] = [];
    const stack = [root];
    while (stack.length > 0) {
      const id = stack.pop()!;
      result.push(id);
      const kids = childrenOf.get(id) ?? [];
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
    return result;
  }

  const avgBranchLen = Math.max(1, nodes.length / rootKids.length);
  const baseQuantum = Math.max(1, Math.round(Math.pow(avgBranchLen, priorityBias)));

  // Build process list with per-process quantum weighted by subtree size when engineBias > 0
  const procs = rootKids.map((id) => {
    const items = dfsOf(id);
    const sizeRatio = items.length / avgBranchLen; // > 1 = larger-than-average branch
    const weightedQuantum = Math.max(1, Math.round(
      baseQuantum * (1 - engineBias) + baseQuantum * sizeRatio * engineBias
    ));
    return { items, ptr: 0, quantum: weightedQuantum };
  });

  const order: number[] = [];
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const p of procs) {
      const end = Math.min(p.ptr + p.quantum, p.items.length);
      for (let i = p.ptr; i < end; i++) { order.push(p.items[i]); anyLeft = true; }
      p.ptr = end;
    }
  }
  return order;
}

// Fills weight = direct child count after any layout. Call once on the final node list.
function postProcessWeights(nodes: TreeNode[]): TreeNode[] {
  const childCount = new Map<number, number>();
  nodes.forEach((n) => {
    if (n.parentId !== null) {
      childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
    }
  });
  nodes.forEach((n) => { n.weight = childCount.get(n.id) ?? 0; });
  return nodes;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Scene components ──────────────────────────────────────────────────────────

function StatsCollector({ onStats }: { onStats: (s: RendererStats) => void }) {
  const { gl } = useThree();
  useFrame(() => {
    onStats({ triangles: gl.info.render.triangles, drawCalls: gl.info.render.calls, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
  });
  return null;
}

function GlobeCore() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.12; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 48, 48]} />
      <meshStandardMaterial color="#3b82f6" wireframe opacity={0.25} transparent />
    </mesh>
  );
}

// Edges: vertex-colored by child weight; hides edges for nodes still in entry animation.
// NOTE: WebGL limits line rendering to ~1 CSS pixel width. True variable-width edges require
// Line2/LineMaterial from three/examples, which is a future optimisation. For now edge
// "weight" is expressed through brightness/opacity, which reads clearly in practice.
function Edges({
  displayNodes, allNodes, opacity, nodeSizeByWeight, edgeWeight, edgeWeightByChild,
  entryTimes, animDuration, edgeTick,
}: {
  displayNodes: TreeNode[]; allNodes: TreeNode[];
  opacity: number; nodeSizeByWeight: boolean;
  edgeWeight: number; edgeWeightByChild: boolean;
  entryTimes: Map<number, NodeEntry>; animDuration: number; edgeTick: number;
}) {
  const maxWeight = useMemo(
    () => allNodes.reduce((m, n) => Math.max(m, n.weight), 1),
    [allNodes]
  );

  // edgeTick is included purely to force a re-run after animation timers fire.
  const geometry = useMemo(() => {
    const now = performance.now();
    const pts: number[] = [];
    const cols: number[] = [];
    displayNodes.forEach((node) => {
      // Hide edge while node is still animating — node appears first, then edge.
      const entry = entryTimes.get(node.id);
      if (entry && (now - entry.time) < animDuration * 1000) return;

      const parent = node.parentId !== null ? allNodes[node.parentId] : null;
      pts.push(...node.position, ...(parent ? parent.position : [0, 0, 0]));

      const childW = edgeWeightByChild ? Math.min(node.weight / maxWeight, 1) : 1;
      const base = edgeWeight * (edgeWeightByChild ? (0.2 + 0.8 * childW) : 1);
      cols.push(0.376 * base, 0.643 * base, 0.98, 0.376 * base * 0.5, 0.643 * base * 0.5, 0.7 * base);
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    geo.setAttribute("color", new Float32BufferAttribute(cols, 3));
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayNodes, allNodes, nodeSizeByWeight, edgeWeight, edgeWeightByChild, maxWeight, animDuration, edgeTick]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors opacity={opacity} transparent />
    </lineSegments>
  );
}

const SPLIT_SHRINK = 0.72;

// AnimatedNodes: all mesh transform updates happen in useFrame — zero React re-renders per frame.
// animMode "hinge": child arcs from grandparent direction around parent pivot, full size throughout.
// animMode "split": child slides from parent pos while growing; parent permanently shrinks to SPLIT_SHRINK.
// animMode "scale": child grows in place from 0.
function AnimatedNodes({
  nodes, nodeSize, nodeSizeByWeight, animMode, animDuration, entryTimes,
}: {
  nodes: TreeNode[];
  nodeSize: number;
  nodeSizeByWeight: boolean;
  animMode: "none" | "scale" | "hinge" | "split";
  animDuration: number;
  entryTimes: Map<number, NodeEntry>;
}) {
  const meshMap = useRef(new Map<number, Mesh>());
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const childrenOf = useMemo(() => {
    const map = new Map<number, number[]>();
    nodes.forEach((n) => {
      if (n.parentId !== null) {
        const list = map.get(n.parentId) ?? [];
        list.push(n.id);
        map.set(n.parentId, list);
      }
    });
    return map;
  }, [nodes]);
  const maxWeight = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.weight), 1), [nodes]);

  useFrame(() => {
    const now = performance.now();
    for (const [id, mesh] of meshMap.current) {
      const node = nodeById.get(id);
      if (!node) { mesh.scale.setScalar(0); continue; }

      const ws = nodeSizeByWeight ? 0.45 + 1.1 * (node.weight / maxWeight) : 1.0;
      const entry = entryTimes.get(id);
      const elapsedT = entry ? Math.min((now - entry.time) / (animDuration * 1000), 1) : 1;
      const t = easeOutCubic(elapsedT);

      // ── Position ────────────────────────────────────────────────────────────
      if (entry && elapsedT < 1 && animMode !== "none" && animMode !== "scale") {
        if (animMode === "hinge") {
          const parent = node.parentId !== null ? nodeById.get(node.parentId) : null;
          const pp: Vec3 = parent ? parent.position : [0, 0, 0];
          const startDir = normalize(sub3(entry.startPos, pp));
          const endDir = normalize(sub3(node.position, pp));
          // Radius shrinks slightly at the start of the arc (clears parent sphere), then grows back.
          const r = dist3(node.position, pp) * (0.86 + 0.14 * t);
          const d = slerpVec3(startDir, endDir, t);
          mesh.position.set(pp[0]+d[0]*r, pp[1]+d[1]*r, pp[2]+d[2]*r);
        } else if (animMode === "split") {
          mesh.position.set(
            entry.startPos[0] + (node.position[0] - entry.startPos[0]) * t,
            entry.startPos[1] + (node.position[1] - entry.startPos[1]) * t,
            entry.startPos[2] + (node.position[2] - entry.startPos[2]) * t,
          );
        }
      } else {
        mesh.position.set(...node.position);
      }

      // ── Scale ────────────────────────────────────────────────────────────────
      // childScaleT: how far along this node's own entry animation is (scale+split modes only)
      const childScaleT = (animMode === "scale" || animMode === "split") && entry ? t : 1;

      // parentShrinkFactor: permanent reduction once this node's first child appears (split only)
      let parentShrinkFactor = 1.0;
      if (animMode === "split") {
        const kids = childrenOf.get(id);
        if (kids) {
          let firstKidTime = Infinity;
          for (const cid of kids) {
            const ke = entryTimes.get(cid);
            if (ke) firstKidTime = Math.min(firstKidTime, ke.time);
          }
          if (firstKidTime < Infinity) {
            const sp = easeOutCubic(Math.min((now - firstKidTime) / (animDuration * 1000), 1));
            parentShrinkFactor = 1 - (1 - SPLIT_SHRINK) * sp;
          }
        }
      }

      mesh.scale.setScalar(ws * childScaleT * parentShrinkFactor);
    }
  });

  return (
    <>
      {nodes.map((node) => (
        <mesh
          key={node.id}
          position={node.position}
          ref={(ref) => {
            if (ref) {
              if (animMode !== "none") ref.scale.setScalar(0);
              meshMap.current.set(node.id, ref);
            } else {
              meshMap.current.delete(node.id);
            }
          }}
        >
          <sphereGeometry args={[nodeSize, 8, 8]} />
          <meshStandardMaterial
            color={node.parentId === null ? "#10b981" : "#60a5fa"}
            emissive={node.parentId === null ? "#059669" : "#2563eb"}
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
    </>
  );
}

// Labels use Html (not Text) to avoid COEP blocking an external font fetch.
const MAX_LABEL_NODES = 250;
function Labels({ nodes, nodeSize }: { nodes: TreeNode[]; nodeSize: number }) {
  const offset = nodeSize * 1.6 + 0.04;
  if (nodes.length > MAX_LABEL_NODES) {
    return (
      <Html position={[0, -3.5, 0]} center>
        <span style={{ color: "#f87171", fontSize: "11px", fontFamily: "monospace", background: "rgba(0,0,0,0.7)", padding: "2px 6px", borderRadius: "4px" }}>
          Labels hidden — {nodes.length} nodes in scene (limit {MAX_LABEL_NODES})
        </span>
      </Html>
    );
  }
  return (
    <>
      {nodes.map((node) => {
        if (!node.label) return null;
        return (
          <Html
            key={node.id}
            position={[node.position[0], node.position[1] + offset, node.position[2]]}
            center
            distanceFactor={5}
            style={{ pointerEvents: "none" }}
          >
            <span style={{ color: "white", fontSize: "9px", fontFamily: "monospace", background: "rgba(0,0,0,0.65)", padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap", userSelect: "none" }}>
              {node.label}
            </span>
          </Html>
        );
      })}
    </>
  );
}

// Runs inside the R3F Canvas; increments visibleCount via useFrame at the configured speed.
function AnimationController({ active, speed, onIncrement }: { active: boolean; speed: number; onIncrement: (n: number) => void }) {
  const acc = useRef(0);
  const onIncrementRef = useRef(onIncrement);
  onIncrementRef.current = onIncrement;
  useFrame((_, delta) => {
    if (!active) { acc.current = 0; return; }
    acc.current += delta * speed;
    const toAdd = Math.floor(acc.current);
    if (toAdd >= 1) { acc.current -= toAdd; onIncrementRef.current(toAdd); }
  });
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GlobeTest({
  config,
  onStats,
  animResetToken,
  onProgress,
}: {
  config: GlobeConfig;
  onStats: (s: RendererStats) => void;
  animResetToken: number;
  onProgress?: (visible: number, total: number) => void;
}) {
  const nodes = useMemo(() => {
    let result: TreeNode[];
    if (config.layout === "recursive") {
      const tree = config.dataSource === "eco"
        ? buildDefaultCatalogTree()
        : buildSyntheticMoveTree(config.nodeCount, config.depthShells);
      result = layoutRecursive(tree, config.depthShells);
    } else {
      result = config.dataSource === "eco"
        ? buildEcoTree(config.depthShells)
        : buildTree(config.nodeCount, config.depthShells);
    }
    // Apply node cap to both modes. DFS layout guarantees parent index < child index,
    // so slicing is safe — all parentId references within the slice remain valid.
    if (result.length > config.nodeCount) result = result.slice(0, config.nodeCount);
    return postProcessWeights(result);
  }, [config.layout, config.dataSource, config.nodeCount, config.depthShells]);

  const buildOrder = useMemo(
    () => computeBuildOrder(nodes, config.buildAnimPriority, config.engineBias),
    [nodes, config.buildAnimPriority, config.engineBias]
  );

  const [visibleCount, setVisibleCount] = useState(nodes.length);

  // Always report actual scene node count so the page stats stay accurate.
  useEffect(() => { onProgress?.(nodes.length, nodes.length); }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show all when animation disabled; restart from 0 when enabled.
  useEffect(() => {
    setVisibleCount(config.buildAnim ? 0 : nodes.length);
  }, [config.buildAnim, nodes]);

  // External reset token (Restart button).
  useEffect(() => {
    if (config.buildAnim) setVisibleCount(0);
  }, [animResetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIncrement = useCallback((delta: number) => {
    setVisibleCount((prev) => Math.min(prev + delta, nodes.length));
  }, [nodes.length]);

  // Report progress to parent after visibleCount settles — must not be called inside setState.
  useEffect(() => {
    onProgress?.(visibleCount, nodes.length);
  }, [visibleCount, nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPlaying = config.buildAnim && visibleCount < nodes.length;

  const displayNodes = useMemo(() => {
    if (!config.buildAnim || visibleCount >= nodes.length) return nodes;
    const visible = new Set(buildOrder.slice(0, visibleCount));
    return nodes.filter((n) => visible.has(n.id));
  }, [config.buildAnim, visibleCount, nodes, buildOrder]);

  // Track per-node entry records (timestamp + animation start position).
  const entryTimesRef = useRef(new Map<number, NodeEntry>());
  const prevDisplayIdsRef = useRef(new Set<number>());

  useEffect(() => {
    const mode = config.nodeEntryAnim;
    const animOn = config.buildAnim && mode !== "none";
    if (!animOn) { entryTimesRef.current.clear(); prevDisplayIdsRef.current.clear(); return; }
    const now = performance.now();
    const prev = prevDisplayIdsRef.current;
    displayNodes.forEach((n) => {
      if (prev.has(n.id)) return;
      const parent = n.parentId !== null ? nodes[n.parentId] : null;
      const grandparent = parent?.parentId !== null && parent?.parentId !== undefined
        ? nodes[parent.parentId] : null;
      // hinge: arc from grandparent position (or origin if none)
      // split: slide from parent position (or origin if root)
      // scale: startPos unused, just need origin as placeholder
      const startPos: Vec3 =
        mode === "hinge"
          ? (grandparent?.position ?? parent?.position ?? [0, 0, 0])
          : mode === "split"
          ? (parent?.position ?? [0, 0, 0])
          : [0, 0, 0];
      entryTimesRef.current.set(n.id, { time: now, startPos });
    });
    prevDisplayIdsRef.current = new Set(displayNodes.map((n) => n.id));
  }, [displayNodes, config.buildAnim, config.nodeEntryAnim, nodes]);

  // Clear entry times on external reset or node list change.
  useEffect(() => {
    entryTimesRef.current.clear();
    prevDisplayIdsRef.current.clear();
  }, [animResetToken, nodes]);

  const animMode = config.buildAnim ? config.nodeEntryAnim : "none";

  // edgeTick fires after animDuration so Edges re-evaluates which nodes have finished animating.
  const [edgeTick, setEdgeTick] = useState(0);
  useEffect(() => {
    if (animMode === "none") return;
    const t = setTimeout(() => setEdgeTick((n) => n + 1), config.nodeAnimDuration * 1000 + 30);
    return () => clearTimeout(t);
  }, [displayNodes, animMode, config.nodeAnimDuration]);

  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 55 }} style={{ background: "#070711" }}>
      <AdaptiveDpr pixelated />
      <Stats />
      <StatsCollector onStats={onStats} />
      <AnimationController active={isPlaying} speed={config.buildAnimSpeed} onIncrement={handleIncrement} />
      <ambientLight intensity={1.0} />
      <hemisphereLight args={["#1e3a8a", "#0f0f1a", 1.0]} />
      <GlobeCore />
      <Edges
        displayNodes={displayNodes}
        allNodes={nodes}
        opacity={config.edgeOpacity}
        nodeSizeByWeight={config.nodeSizeByWeight}
        edgeWeight={config.edgeWeight}
        edgeWeightByChild={config.edgeWeightByChild}
        entryTimes={entryTimesRef.current}
        animDuration={config.nodeAnimDuration}
        edgeTick={edgeTick}
      />
      <AnimatedNodes
        nodes={displayNodes}
        nodeSize={config.nodeSize}
        nodeSizeByWeight={config.nodeSizeByWeight}
        animMode={animMode}
        animDuration={config.nodeAnimDuration}
        entryTimes={entryTimesRef.current}
      />
      {config.showLabels && <Labels nodes={displayNodes} nodeSize={config.nodeSize} />}
      <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={16} autoRotate autoRotateSpeed={config.rotateSpeed} />
    </Canvas>
  );
}
