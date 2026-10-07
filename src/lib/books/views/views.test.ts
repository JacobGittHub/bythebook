import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/fen";
import { mulberry32, type Rng } from "@/lib/regions/prng";
import { expectNoViolations } from "@/lib/regions/testShapes";
import {
  buildViewTree,
  families,
  heavyLeaf,
  isAncestorOrSelf,
  lineText,
  moveLabel,
  pathTo,
  plyOfFen,
  type ViewSource,
  type ViewTree,
} from "@/lib/books/viewTree";
import { BRANCH_FOLD_BELOW, branchPointsLayout } from "./branchPoints";
import { icicleLayout } from "./icicle";
import { METRO_NUDGE, METRO_ROW_GAP, metroLayout } from "./metro";
import { plyColumnsLayout } from "./plyColumns";
import { spineLayout } from "./spine";
import type { Box } from "./common";

const SEEDS = 80;
const EPS = 1e-6;

/** A random tree shape. Layouts read only the shape, so moves are made-up names. */
function randomSource(rng: Rng): ViewSource {
  const maxDepth = 1 + Math.floor(rng() * 14);
  const bushiness = rng();
  const build = (id: string, depth: number): ViewSource => {
    const count =
      depth >= maxDepth ? 0 : rng() < 0.35 + bushiness * 0.3 ? 1 + Math.floor(rng() * 4) : rng() < 0.7 ? 1 : 0;
    const children = Array.from({ length: depth === 0 ? Math.max(count, 1) : count }, (_, k) =>
      build(`${id}:m${k}`, depth + 1),
    );
    return {
      id,
      san: depth === 0 ? null : `m${id.length % 97}`,
      uci: depth === 0 ? null : id.slice(-3),
      fen: START_FEN,
      games: rng() < 0.5 ? null : Math.floor(rng() * 10_000),
      children,
    };
  };
  return build("root", 0);
}

function randomBox(rng: Rng): Box {
  return { width: 160 + Math.floor(rng() * 1000), height: 120 + Math.floor(rng() * 500) };
}

function eachTree(check: (tree: ViewTree, box: Box, seed: number, rng: Rng) => void) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = mulberry32(seed);
    check(buildViewTree(randomSource(rng)), randomBox(rng), seed, rng);
  }
}

const inside = (p: { x: number; y: number }, width: number, height: number) =>
  p.x >= -EPS && p.y >= -EPS && p.x <= width + EPS && p.y <= height + EPS;

describe("view tree", () => {
  const line = (sans: string[]): ViewSource => {
    let node: ViewSource = { id: "leaf", san: sans.at(-1)!, uci: "x", fen: START_FEN, children: [] };
    for (let i = sans.length - 2; i >= -1; i--) {
      node = { id: `n${i}`, san: i < 0 ? null : sans[i], uci: i < 0 ? null : `u${i}`, fen: START_FEN, children: [node] };
    }
    return node;
  };

  it("numbers moves from the root's FEN", () => {
    expect(plyOfFen(START_FEN)).toBe(0);
    expect(plyOfFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")).toBe(2);
    const tree = buildViewTree(line(["d4", "d5", "c4"]));
    const leaf = heavyLeaf(tree.root);
    expect(moveLabel(leaf)).toBe("2.c4");
    expect(lineText(pathTo(leaf))).toBe("1.d4 d5 2.c4");
    expect(lineText(pathTo(leaf).slice(2))).toBe("1...d5 2.c4");
  });

  it("counts positions and lines, and orders siblings the same way every time", () => {
    const violations: string[] = [];
    eachTree((tree, _box, seed) => {
      for (const node of tree.nodes) {
        const size = node.children.reduce((sum, child) => sum + child.size, node.depth > 0 ? 1 : 0);
        if (node.size !== size) violations.push(`seed ${seed}: ${node.id} size ${node.size}, expected ${size}`);
        const leaves = node.children.length ? node.children.reduce((sum, child) => sum + child.leaves, 0) : 1;
        if (node.leaves !== leaves) violations.push(`seed ${seed}: ${node.id} leaves`);
        for (const child of node.children) {
          if (child.parent !== node || child.depth !== node.depth + 1) violations.push(`seed ${seed}: ${child.id} links`);
        }
      }
    });
    expectNoViolations(violations);
    const rng = mulberry32(7);
    const source = randomSource(rng);
    expect(buildViewTree(source).nodes.map((n) => n.id)).toEqual(buildViewTree(source).nodes.map((n) => n.id));
  });

  it("gives every node below the trunk the family of the move it splits into", () => {
    const violations: string[] = [];
    eachTree((tree, _box, seed) => {
      const family = families(tree);
      for (const node of tree.nodes) {
        if (!family.has(node.id)) violations.push(`seed ${seed}: ${node.id} has no family`);
        const parent = node.parent;
        if (parent && family.get(parent.id)! >= 0 && family.get(parent.id) !== family.get(node.id)) {
          violations.push(`seed ${seed}: ${node.id} left its parent's family`);
        }
      }
    });
    expectNoViolations(violations);
  });
});

describe("A. ply columns", () => {
  it("puts each position in its ply's column, each line in its own row, each position between its moves", () => {
    const violations: string[] = [];
    eachTree((tree, box, seed) => {
      const layout = plyColumnsLayout(tree, box);
      let lastLeafY = -Infinity;
      for (const node of tree.nodes) {
        const p = layout.points.get(node.id);
        if (!p) {
          violations.push(`seed ${seed}: ${node.id} not placed`);
          continue;
        }
        if (!inside(p, layout.width, layout.height)) violations.push(`seed ${seed}: ${node.id} outside`);
        if (node.parent && Math.abs(p.x - layout.points.get(node.parent.id)!.x - layout.colW) > EPS) {
          violations.push(`seed ${seed}: ${node.id} not one column after its parent`);
        }
        if (!node.children.length) {
          if (p.y < lastLeafY + layout.rowH - EPS) violations.push(`seed ${seed}: ${node.id} row overlaps`);
          lastLeafY = p.y;
        } else {
          const ys = node.children.map((child) => layout.points.get(child.id)!.y);
          if (p.y < Math.min(...ys) - EPS || p.y > Math.max(...ys) + EPS) {
            violations.push(`seed ${seed}: ${node.id} outside its moves' rows`);
          }
        }
      }
    });
    expectNoViolations(violations);
  });
});

describe("B. branch points", () => {
  it("shows every position once or folds it, and keeps the selected line open", () => {
    const violations: string[] = [];
    eachTree((tree, box, seed, rng) => {
      const selected = tree.nodes[Math.floor(rng() * tree.nodes.length)];
      const keep = new Set(pathTo(selected).map((node) => node.id));
      const layout = branchPointsLayout(tree, box, keep);
      const shown = new Map<string, number>();
      let folded = 0;
      for (const s of layout.segments) {
        folded += s.folded;
        for (const node of s.run) shown.set(node.id, (shown.get(node.id) ?? 0) + 1);
        if (s.run.at(-1) !== s.end) violations.push(`seed ${seed}: stretch doesn't end at its end`);
        for (let i = 1; i < s.run.length; i++) {
          if (s.run[i].parent !== s.run[i - 1] || s.run[i - 1].children.length !== 1) {
            violations.push(`seed ${seed}: stretch ${s.end.id} isn't a run of single moves`);
          }
        }
        for (const child of s.children) {
          if (child.run[0].parent !== s.end) violations.push(`seed ${seed}: ${child.end.id} misplaced`);
          if (child.x <= s.x) violations.push(`seed ${seed}: ${child.end.id} not right of its split`);
        }
        if (!inside(s, layout.width, layout.height)) violations.push(`seed ${seed}: ${s.end.id} outside`);
      }
      for (const [id, times] of shown) if (times > 1) violations.push(`seed ${seed}: ${id} shown ${times} times`);
      const visiblePositions = [...shown.keys()].filter((id) => id !== tree.root.id).length;
      if (visiblePositions + folded !== tree.root.size) {
        violations.push(`seed ${seed}: ${visiblePositions} shown + ${folded} folded != ${tree.root.size}`);
      }
      for (const id of keep) if (!shown.has(id)) violations.push(`seed ${seed}: selected line folded at ${id}`);
      for (const s of layout.segments) {
        for (const child of s.end.children) {
          if (!shown.has(child.id) && child.size >= BRANCH_FOLD_BELOW) violations.push(`seed ${seed}: big branch folded`);
        }
      }
    });
    expectNoViolations(violations);
  });
});

describe("C. metro map", () => {
  it("puts every position on one route, and keeps routes in a row apart", () => {
    const violations: string[] = [];
    eachTree((tree, box, seed) => {
      const layout = metroLayout(tree, box);
      const seen = new Set<string>();
      for (const [index, track] of layout.tracks.entries()) {
        for (let i = 0; i < track.nodes.length; i++) {
          const node = track.nodes[i];
          if (seen.has(node.id)) violations.push(`seed ${seed}: ${node.id} on two routes`);
          seen.add(node.id);
          if (layout.trackOf.get(node.id) !== index) violations.push(`seed ${seed}: ${node.id} track index`);
          const expectedParent = i === 0 ? track.from : track.nodes[i - 1];
          if (node.parent !== expectedParent) violations.push(`seed ${seed}: route ${index} isn't a line`);
          if (!inside(layout.points.get(node.id)!, layout.width, layout.height)) {
            violations.push(`seed ${seed}: ${node.id} outside`);
          }
        }
        if (Math.abs(track.nudge) > METRO_NUDGE + EPS) violations.push(`seed ${seed}: nudge too far`);
      }
      if (seen.size !== tree.nodes.length) violations.push(`seed ${seed}: ${tree.nodes.length - seen.size} unplaced`);
      // Routes in one row have clear space between them, so two can't read as one.
      for (let i = 0; i < layout.tracks.length; i++) {
        for (let j = i + 1; j < layout.tracks.length; j++) {
          const [p, q] = [layout.tracks[i], layout.tracks[j]];
          if (p.row !== q.row) continue;
          const apart = p.span[0] >= q.span[1] + METRO_ROW_GAP - EPS || q.span[0] >= p.span[1] + METRO_ROW_GAP - EPS;
          if (!apart) violations.push(`seed ${seed}: routes ${i} and ${j} crowd row ${p.row}`);
          if (p.from && p.from === q.from) violations.push(`seed ${seed}: sibling routes share row ${p.row}`);
        }
      }
    });
    expectNoViolations(violations);
  });
});

describe("D. icicle", () => {
  it("keeps every block inside its parent's rows, with siblings stacked and filling it", () => {
    const violations: string[] = [];
    for (const weight of ["lines", "games"] as const) {
      eachTree((tree, box, seed) => {
        const layout = icicleLayout(tree, box, weight);
        for (const node of tree.nodes) {
          if (!node.children.length) continue;
          const parent = node.parent ? layout.cells.get(node.id)! : null;
          const top = parent ? parent.y : layout.cells.get(node.children[0].id)!.y;
          let y = top;
          for (const child of node.children) {
            const cell = layout.cells.get(child.id);
            if (!cell) {
              violations.push(`seed ${seed}: ${child.id} not placed`);
              continue;
            }
            if (Math.abs(cell.y - y) > EPS) violations.push(`seed ${seed} ${weight}: ${child.id} not stacked`);
            if (cell.height <= 0) violations.push(`seed ${seed} ${weight}: ${child.id} has no height`);
            if (parent && Math.abs(cell.x - parent.x - layout.colW) > EPS) {
              violations.push(`seed ${seed}: ${child.id} not one column after its parent`);
            }
            y += cell.height;
          }
          if (parent && Math.abs(y - (parent.y + parent.height)) > 1e-6 * Math.max(1, parent.height)) {
            violations.push(`seed ${seed} ${weight}: ${node.id}'s moves don't fill it`);
          }
          if (!parent && (top < -EPS || y > layout.height + EPS)) violations.push(`seed ${seed}: outside`);
        }
      });
    }
    expectNoViolations(violations);
  });
});

describe("E. spine and ribs", () => {
  it("lays the spine straight, gives every other move a rib, and keeps rib labels apart", () => {
    const violations: string[] = [];
    eachTree((tree, box, seed, rng) => {
      const end = tree.nodes[Math.floor(rng() * tree.nodes.length)];
      const layout = spineLayout(tree, box, end, rng() < 0.5 ? "positions" : "games");
      const path = pathTo(end);
      if (layout.spine.length !== path.length) violations.push(`seed ${seed}: spine length`);
      for (let i = 1; i < layout.spine.length; i++) {
        if (layout.spine[i].x <= layout.spine[i - 1].x) violations.push(`seed ${seed}: spine goes back`);
      }
      const expected = path.flatMap((node, i) => node.children.filter((child) => child !== path[i + 1]));
      const got = new Set(layout.ribs.map((rib) => rib.node.id));
      if (got.size !== expected.length || expected.some((node) => !got.has(node.id))) {
        violations.push(`seed ${seed}: ribs don't match the spine's other moves`);
      }
      for (const rib of layout.ribs) {
        if (rib.node.parent !== rib.from || isAncestorOrSelf(rib.node, end)) violations.push(`seed ${seed}: rib ${rib.node.id}`);
        if (!inside(rib, layout.width, layout.height)) violations.push(`seed ${seed}: rib ${rib.node.id} outside`);
        if (Math.sign(rib.y - layout.midY) !== rib.side) violations.push(`seed ${seed}: rib on the wrong side`);
      }
      for (let i = 0; i < layout.ribs.length; i++) {
        for (let j = i + 1; j < layout.ribs.length; j++) {
          const [p, q] = [layout.ribs[i], layout.ribs[j]];
          if (p.side !== q.side || p.level !== q.level) continue;
          if (p.extent[0] < q.extent[1] && q.extent[0] < p.extent[1]) {
            violations.push(`seed ${seed}: ribs ${p.node.id} and ${q.node.id} overlap`);
          }
        }
      }
    });
    expectNoViolations(violations);
  });
});

describe("every layout", () => {
  it("is the same for the same tree and box", () => {
    const violations: string[] = [];
    eachTree((tree, box, seed) => {
      const again = buildViewTree(randomSourceFor(seed));
      const pairs: [unknown, unknown][] = [
        [plyColumnsLayout(tree, box).points, plyColumnsLayout(again, box).points],
        [metroLayout(tree, box).points, metroLayout(again, box).points],
        [icicleLayout(tree, box).cells, icicleLayout(again, box).cells],
        [spineLayout(tree, box, heavyLeaf(tree.root)).ribs.map((r) => [r.x, r.y]), spineLayout(again, box, heavyLeaf(again.root)).ribs.map((r) => [r.x, r.y])],
        [branchPointsLayout(tree, box).segments.map((s) => [s.x, s.y]), branchPointsLayout(again, box).segments.map((s) => [s.x, s.y])],
      ];
      for (const [index, [a, b]] of pairs.entries()) {
        const text = (value: unknown) => JSON.stringify(value instanceof Map ? [...value] : value);
        if (text(a) !== text(b)) violations.push(`seed ${seed}: layout ${index} differs between runs`);
      }
    });
    expectNoViolations(violations);
  });
});

/** The tree `eachTree` builds for this seed. */
function randomSourceFor(seed: number): ViewSource {
  return randomSource(mulberry32(seed));
}
