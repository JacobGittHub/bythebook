"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stats, Text, Billboard } from "@react-three/drei";
import { Mesh, BufferGeometry, Float32BufferAttribute } from "three";
import { buildDefaultCatalogTree } from "@/lib/chess/openingCatalog";
import type { MoveNode } from "@/types/chess";

export type GlobeConfig = {
  nodeCount: number;
  rotateSpeed: number;
  nodeSize: number;
  depthShells: number;
  edgeOpacity: number;
  dataSource: "synthetic" | "eco";
  layout: "fibonacci" | "recursive";
  showLabels: boolean;
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
};

// ── Vec3 helpers ──────────────────────────────────────────────────────────────

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-9) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function buildOrthonormalFrame(axis: Vec3): { axis: Vec3; right: Vec3; up: Vec3 } {
  const ref: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cx = axis[1] * ref[2] - axis[2] * ref[1];
  const cy = axis[2] * ref[0] - axis[0] * ref[2];
  const cz = axis[0] * ref[1] - axis[1] * ref[0];
  const right = normalize([cx, cy, cz]);
  const ux = axis[1] * right[2] - axis[2] * right[1];
  const uy = axis[2] * right[0] - axis[0] * right[2];
  const uz = axis[0] * right[1] - axis[1] * right[0];
  return { axis, right, up: [ux, uy, uz] };
}

// ── Synthetic flat tree (Fibonacci layout) ────────────────────────────────────

function buildTree(nodeCount: number, depthShells: number): TreeNode[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const shellSize = Math.max(1, Math.ceil(nodeCount / depthShells));
  const nodes: TreeNode[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const depth = Math.min(Math.floor(i / shellSize), depthShells - 1);
    const r = 1.3 + depth * 0.65;
    const localIndex = i - depth * shellSize;
    const localTotal = Math.min(shellSize, nodeCount - depth * shellSize);
    const y = 1 - (localIndex / Math.max(localTotal - 1, 1)) * 2;
    const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;

    const position: Vec3 = [
      r * radiusXZ * Math.cos(theta),
      r * y,
      r * radiusXZ * Math.sin(theta),
    ];

    let parentId: number | null = null;
    if (depth > 0) {
      const prevShellStart = (depth - 1) * shellSize;
      const prevShellCount = Math.min(shellSize, nodeCount - prevShellStart);
      parentId = prevShellStart + (i % Math.max(prevShellCount, 1));
    }

    nodes.push({ id: i, position, depth, parentId, label: `N${i}` });
  }

  return nodes;
}

// ── ECO flat tree (Fibonacci layout) ──────────────────────────────────────────

function flattenMoveNodeFlat(
  node: MoveNode,
  depth: number,
  parentId: number | null,
  out: TreeNode[],
  maxDepth: number
): void {
  if (depth > maxDepth) return;
  const id = out.length;
  out.push({
    id,
    position: [0, 0, 0],
    depth,
    parentId,
    label: node.san ?? undefined,
  });
  for (const child of node.children) {
    flattenMoveNodeFlat(child, depth + 1, id, out, maxDepth);
  }
}

function buildEcoTree(maxDepth: number): TreeNode[] {
  const root = buildDefaultCatalogTree();
  const nodes: TreeNode[] = [];
  flattenMoveNodeFlat(root, 0, null, nodes, maxDepth);

  const byDepth = new Map<number, number[]>();
  nodes.forEach((n) => {
    const arr = byDepth.get(n.depth) ?? [];
    arr.push(n.id);
    byDepth.set(n.depth, arr);
  });
  const localIndexOf = new Map<number, number>();
  byDepth.forEach((ids) => ids.forEach((id, i) => localIndexOf.set(id, i)));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const actualMaxDepth = byDepth.size - 1;

  nodes.forEach((node) => {
    const localIndex = localIndexOf.get(node.id)!;
    const localTotal = byDepth.get(node.depth)!.length;
    const r = 1.3 + (node.depth / Math.max(actualMaxDepth, 1)) * (maxDepth * 0.65);
    const y = 1 - (localIndex / Math.max(localTotal - 1, 1)) * 2;
    const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * localIndex;
    node.position = [r * radiusXZ * Math.cos(theta), r * y, r * radiusXZ * Math.sin(theta)];
  });

  return nodes;
}

// ── Synthetic MoveNode tree (used by recursive layout) ────────────────────────

function buildSyntheticMoveTree(nodeCount: number, maxDepth: number): MoveNode {
  const root: MoveNode = { id: "0", san: null, uci: null, fen: "", children: [] };
  if (nodeCount <= 1) return root;

  const branching = Math.max(2, Math.round(Math.pow(nodeCount, 1 / Math.max(1, maxDepth))));
  type Frame = { node: MoveNode; depth: number; pathLabel: string };
  const queue: Frame[] = [{ node: root, depth: 0, pathLabel: "" }];
  let nextId = 1;

  while (queue.length > 0 && nextId < nodeCount) {
    const { node, depth, pathLabel } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const remaining = nodeCount - nextId;
    const numChildren = Math.min(branching, remaining);
    for (let i = 0; i < numChildren; i++) {
      const childLabel = pathLabel ? `${pathLabel}.${i + 1}` : `${i + 1}`;
      const child: MoveNode = {
        id: `${nextId}`,
        san: childLabel,
        uci: null,
        fen: "",
        children: [],
      };
      nextId++;
      node.children.push(child);
      queue.push({ node: child, depth: depth + 1, pathLabel: childLabel });
      if (nextId >= nodeCount) break;
    }
  }

  return root;
}

// ── Recursive sphere-shell layout ─────────────────────────────────────────────
// Each parent's children sit on a smaller sphere shell around the parent.
// Root's children spread over a full sphere (Fibonacci); deeper children sit in
// a cone biased outward (origin → parent direction). Shell radius decays each
// level so the tree visually densifies as depth grows. Root itself isn't
// rendered — it lives at the origin alongside the globe core.

const RECURSIVE_FIRST_RADIUS = 1.7;
const RECURSIVE_DECAY = 0.62;
const RECURSIVE_BASE_CONE = Math.PI / 3; // 60°

function layoutRecursive(root: MoveNode, maxDepth: number): TreeNode[] {
  const out: TreeNode[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  function place(
    node: MoveNode,
    depth: number,
    parentId: number | null,
    position: Vec3
  ): void {
    if (depth > maxDepth + 1) return; // depth includes the skipped root, so +1

    let myId: number | null = null;
    if (depth > 0) {
      // Skip the synthetic/ECO root — only real moves get rendered.
      myId = out.length;
      out.push({
        id: myId,
        position,
        depth: depth - 1,
        parentId,
        label: node.san ?? undefined,
      });
    }

    if (depth > maxDepth) return;

    const n = node.children.length;
    if (n === 0) return;

    const childRadius = RECURSIVE_FIRST_RADIUS * Math.pow(RECURSIVE_DECAY, depth);

    if (depth === 0) {
      // Root's children: even Fibonacci distribution across full sphere
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;
        const childPos: Vec3 = [
          radius * Math.cos(theta) * childRadius,
          y * childRadius,
          radius * Math.sin(theta) * childRadius,
        ];
        place(node.children[i], depth + 1, myId, childPos);
      }
      return;
    }

    // Non-root: cone biased along outward direction (origin → parent)
    const outward = normalize(position);
    const frame = buildOrthonormalFrame(outward);
    const cone =
      n === 1
        ? 0
        : Math.min(Math.PI / 2.1, RECURSIVE_BASE_CONE * Math.sqrt(n / 3));

    for (let i = 0; i < n; i++) {
      const azimuth = (i / n) * Math.PI * 2;
      const cosCone = Math.cos(cone);
      const sinCone = Math.sin(cone);
      const cosAz = Math.cos(azimuth);
      const sinAz = Math.sin(azimuth);
      const dir: Vec3 = [
        frame.axis[0] * cosCone + (frame.right[0] * cosAz + frame.up[0] * sinAz) * sinCone,
        frame.axis[1] * cosCone + (frame.right[1] * cosAz + frame.up[1] * sinAz) * sinCone,
        frame.axis[2] * cosCone + (frame.right[2] * cosAz + frame.up[2] * sinAz) * sinCone,
      ];
      const childPos: Vec3 = [
        position[0] + dir[0] * childRadius,
        position[1] + dir[1] * childRadius,
        position[2] + dir[2] * childRadius,
      ];
      place(node.children[i], depth + 1, myId, childPos);
    }
  }

  place(root, 0, null, [0, 0, 0]);
  return out;
}

// ── Scene components ──────────────────────────────────────────────────────────

function StatsCollector({ onStats }: { onStats: (s: RendererStats) => void }) {
  const { gl } = useThree();
  useFrame(() => {
    onStats({
      triangles: gl.info.render.triangles,
      drawCalls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    });
  });
  return null;
}

function GlobeCore() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.12;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 48, 48]} />
      <meshStandardMaterial color="#3b82f6" wireframe opacity={0.25} transparent />
    </mesh>
  );
}

function Edges({ nodes, opacity }: { nodes: TreeNode[]; opacity: number }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const ORIGIN: Vec3 = [0, 0, 0];
    nodes.forEach((node) => {
      if (node.parentId !== null) {
        const parent = nodes[node.parentId];
        if (parent) {
          pts.push(...node.position, ...parent.position);
        }
      } else {
        pts.push(...node.position, ...ORIGIN);
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return geo;
  }, [nodes]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#60a5fa" opacity={opacity} transparent />
    </lineSegments>
  );
}

function Nodes({ nodes, nodeSize }: { nodes: TreeNode[]; nodeSize: number }) {
  return (
    <>
      {nodes.map((node) => {
        const isRoot = node.parentId === null;
        return (
          <mesh key={node.id} position={node.position}>
            <sphereGeometry args={[nodeSize, 12, 12]} />
            <meshStandardMaterial
              color={isRoot ? "#10b981" : "#60a5fa"}
              emissive={isRoot ? "#059669" : "#2563eb"}
              emissiveIntensity={0.7}
            />
          </mesh>
        );
      })}
    </>
  );
}

function Labels({ nodes, nodeSize }: { nodes: TreeNode[]; nodeSize: number }) {
  const fontSize = Math.max(0.08, Math.min(0.14, nodeSize * 1.6));
  const offset = nodeSize * 1.6 + 0.04;
  return (
    <>
      {nodes.map((node) => {
        if (!node.label) return null;
        return (
          <Billboard
            key={node.id}
            position={[node.position[0], node.position[1] + offset, node.position[2]]}
          >
            <Text
              fontSize={fontSize}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.004}
              outlineColor="#000000"
            >
              {node.label}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

export default function GlobeTest({
  config,
  onStats,
}: {
  config: GlobeConfig;
  onStats: (s: RendererStats) => void;
}) {
  const nodes = useMemo(() => {
    if (config.layout === "recursive") {
      const tree =
        config.dataSource === "eco"
          ? buildDefaultCatalogTree()
          : buildSyntheticMoveTree(config.nodeCount, config.depthShells);
      return layoutRecursive(tree, config.depthShells);
    }
    return config.dataSource === "eco"
      ? buildEcoTree(config.depthShells)
      : buildTree(config.nodeCount, config.depthShells);
  }, [config.layout, config.dataSource, config.nodeCount, config.depthShells]);

  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 55 }} style={{ background: "#070711" }}>
      <Stats />
      <StatsCollector onStats={onStats} />
      <ambientLight intensity={1.2} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-8, -8, -5]} intensity={1.0} color="#6366f1" />
      <hemisphereLight args={["#1e3a8a", "#0f0f1a", 1.0]} />
      <GlobeCore />
      <Edges nodes={nodes} opacity={config.edgeOpacity} />
      <Nodes nodes={nodes} nodeSize={config.nodeSize} />
      {config.showLabels && <Labels nodes={nodes} nodeSize={config.nodeSize} />}
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={3}
        maxDistance={16}
        autoRotate
        autoRotateSpeed={config.rotateSpeed}
      />
    </Canvas>
  );
}
