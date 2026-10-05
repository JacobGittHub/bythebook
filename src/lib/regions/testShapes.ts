// Random inputs and helpers shared by the region property tests. Test-only.
import { Chess } from "chess.js";
import { expect } from "vitest";
import { EXPLORER_MOVES_LIMIT, gameCount } from "@/lib/chess/explorerData";
import type { ExplorerMove, ExplorerResponse } from "@/types/chess";
import { sampleCircle, type Polygon, type Vec } from "./geometry";
import { rngFor, type Rng } from "./prng";
import type { Blob, RegionStore } from "./store";

/** How many violations a failing property test shows. */
const VIOLATIONS_SHOWN = 5;

/**
 * Asserts that a property test found no violations. Gather them into a list over every run
 * and call this once: an expect per check can make a test slow enough to time out, and a
 * full list of thousands is unreadable, so a failure shows the first few and the count.
 */
export function expectNoViolations(violations: string[]) {
  expect(
    violations.slice(0, VIOLATIONS_SHOWN),
    `${violations.length} violations; the first ${VIOLATIONS_SHOWN} are shown`,
  ).toEqual([]);
}

/** Convex hull, counter-clockwise (Andrew's monotone chain). */
export function convexHull(points: readonly Vec[]): Vec[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const half = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };

  return [...half(sorted), ...half([...sorted].reverse())];
}

function rotate(points: readonly Vec[], angle: number): Vec[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** A convex region from one of several families: circle, random hull, long rectangle, triangle. */
export function randomRegion(rng: Rng): Polygon {
  const kind = Math.floor(rng() * 4);

  if (kind === 0) return sampleCircle({ x: 0, y: 0 }, 1 / Math.sqrt(Math.PI), 128);

  if (kind === 1) {
    const count = 5 + Math.floor(rng() * 30);
    return convexHull(Array.from({ length: count }, () => ({ x: rng(), y: rng() })));
  }

  if (kind === 2) {
    const w = 1;
    const h = 0.1 + rng() * 0.9;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
    return rotate(corners, rng() * Math.PI);
  }

  // A triangle that isn't too flat.
  const angles = [0, 1, 2].map((i) => (i * 2 * Math.PI) / 3 + (rng() - 0.5) * 1.2);
  return angles.map((a) => ({ x: Math.cos(a), y: Math.sin(a) }));
}

/** Positive weights: flat, long-tailed, or dominated by the first few, like real move counts. */
export function randomWeights(rng: Rng, count: number): number[] {
  const kind = Math.floor(rng() * 3);
  return Array.from({ length: count }, (_, i) => {
    if (kind === 0) return 0.2 + rng();
    if (kind === 1) return 1 / Math.pow(i + 1, 1.5);
    return Math.pow(0.5, i) * (0.5 + rng());
  });
}

/**
 * Made-up explorer data for a position: its legal moves with long-tailed game counts. Like
 * the real explorer, it lists at most `EXPLORER_MOVES_LIMIT` moves, and its totals also
 * count the moves it leaves out. The same position and seed always give the same data.
 */
export function fakeExplorerData(fen: string, seed = 0): ExplorerResponse {
  const rng = rngFor(fen, seed);
  const legal = new Chess(fen).moves({ verbose: true });

  const all: ExplorerMove[] = legal.map((move) => ({ san: move.san, uci: move.lan, white: 0, draws: 0, black: 0 }));
  // Rank the moves at random, then give each a count that falls off with its rank.
  const ranked = all
    .map((move) => ({ move, key: rng() }))
    .sort((a, b) => a.key - b.key || (a.move.uci < b.move.uci ? -1 : 1))
    .map(({ move }, rank) => {
      const games = Math.floor((200_000 * (0.5 + rng())) / Math.pow(rank + 1, 2.2));
      const white = Math.floor(games * 0.4);
      const draws = Math.floor(games * 0.35);
      return { ...move, white, draws, black: games - white - draws };
    })
    .filter((move) => gameCount(move) > 0);

  const sum = (key: "white" | "draws" | "black") => ranked.reduce((total, m) => total + m[key], 0);
  return {
    moves: ranked.slice(0, EXPLORER_MOVES_LIMIT),
    totals: { white: sum("white"), draws: sum("draws"), black: sum("black") },
    movesLimit: EXPLORER_MOVES_LIMIT,
  };
}

/** Every blob in the store, each after its parent. */
export function allBlobs(store: RegionStore): Blob[] {
  const out: Blob[] = [];
  const walk = (blob: Blob) => {
    out.push(blob);
    blob.children?.forEach(walk);
  };
  walk(store.root);
  return out;
}

/** Expands every open blob down to `plies` below the root, with made-up data. */
export function growStore(store: RegionStore, plies: number, seed = 0) {
  for (let round = 0; round <= plies; round++) {
    for (const blob of allBlobs(store)) {
      if (blob.status === "open" && blob.depth < plies) store.expand(blob, fakeExplorerData(blob.fen, seed));
    }
  }
}
