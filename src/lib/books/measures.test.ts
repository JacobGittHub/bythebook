import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN, normalizeFen, toPositionKey } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { expectNoViolations } from "@/lib/regions/testShapes";
import type { Move, MoveNode } from "@/types/chess";
import {
  MAX_BOOK_POSITIONS,
  MAX_VERIFIED_BOOK_POSITIONS,
  averageLeafDepth,
  checkPositionLimit,
  countPositions,
  coverage,
  findClashes,
  hasUnconnectedLines,
  leafDepths,
  type MasterMove,
  type MasterMovesLookup,
} from "./measures";

/** A tree from lines of SAN moves, played from `rootFen` with real positions. */
function tree(lines: string[][], rootFen = START_FEN): MoveNode {
  const moveLines = lines.map((sans) => {
    const game = new Chess(rootFen);
    return sans.map((san): Move => {
      const move = game.move(san);
      return { san: move.san, uci: move.from + move.to + (move.promotion ?? ""), fen: game.fen() };
    });
  });
  return buildMoveTreeFromLines(moveLines, rootFen);
}

/** The position after these moves from the start, as a lookup key. */
function keyAfter(...sans: string[]): string {
  const game = new Chess();
  sans.forEach((san) => game.move(san));
  return toPositionKey(game.fen());
}

/** A lookup from a table of position key → { uci: games }. */
function lookupFrom(table: Record<string, Record<string, number>>): MasterMovesLookup {
  return (key) =>
    table[key] ? Object.entries(table[key]).map(([uci, games]) => ({ uci, games })) : null;
}

const AFTER_E4_E5 = (() => {
  const game = new Chess();
  game.move("e4");
  game.move("e5");
  return normalizeFen(game.fen());
})();

describe("positions and the limit", () => {
  it("counts one position per move, across every tree", () => {
    const main = tree([["e4", "e5", "Nf3"], ["e4", "c5"]]);
    expect(countPositions([main])).toBe(4);
    expect(countPositions([main, tree([["Nf3"]], AFTER_E4_E5)])).toBe(5);
    expect(countPositions([])).toBe(0);
  });

  it("allows a verified publisher more positions than anyone else", () => {
    const root: MoveNode = { id: "root", san: null, uci: null, fen: START_FEN, children: [] };
    for (let i = 0; i < MAX_BOOK_POSITIONS + 1; i++) {
      root.children.push({ id: `n${i}`, san: "x", uci: `x${i}`, fen: START_FEN, children: [] });
    }
    expect(checkPositionLimit([root], false)).toEqual({
      count: MAX_BOOK_POSITIONS + 1,
      limit: MAX_BOOK_POSITIONS,
      over: true,
    });
    expect(checkPositionLimit([root], true)).toEqual({
      count: MAX_BOOK_POSITIONS + 1,
      limit: MAX_VERIFIED_BOOK_POSITIONS,
      over: false,
    });
  });
});

describe("hasUnconnectedLines", () => {
  it("is false for one tree from the starting position, or no tree", () => {
    expect(hasUnconnectedLines([tree([["d4", "d5", "c4"]])])).toBe(false);
    expect(hasUnconnectedLines([])).toBe(false);
  });

  it("is true for a tree from a later position, or for several trees", () => {
    expect(hasUnconnectedLines([tree([["Nf3"]], AFTER_E4_E5)])).toBe(true);
    expect(hasUnconnectedLines([tree([["e4"]]), tree([["d4"]])])).toBe(true);
  });
});

describe("leaf depths", () => {
  it("counts a leaf position once, at its shortest move order", () => {
    // Both lines end on the starting position again: once after 4 plies, once after 8.
    const book = tree([
      ["Nf3", "Nf6", "Ng1", "Ng8"],
      ["Nc3", "Nc6", "Nb1", "Nb8", "Nf3", "Nf6", "Ng1", "Ng8"],
      ["e4", "e5"],
    ]);
    expect(leafDepths([book]).sort()).toEqual([2, 4]);
    expect(averageLeafDepth([book])).toBe(3);
  });

  it("has no average for a book without moves", () => {
    expect(averageLeafDepth([])).toBeNull();
    expect(averageLeafDepth([tree([])])).toBeNull();
  });
});

describe("findClashes", () => {
  const book = tree([["e4", "e5"], ["d4", "d5"], ["e4", "c5"]]);

  it("finds the positions where the book's own side has two moves", () => {
    expect(findClashes([book], "white").map((node) => node.id)).toEqual(["root"]);
    expect(findClashes([book], "black").map((node) => node.san)).toEqual(["e4"]);
  });
});

describe("coverage", () => {
  const masters = lookupFrom({
    [toPositionKey(START_FEN)]: { e2e4: 60, d2d4: 40 },
    [keyAfter("e4")]: { e7e5: 30, c7c5: 30 },
  });

  it("lets the other side's missing replies escape", () => {
    expect(coverage([tree([["e4", "e5"]])], "black", masters)).toEqual({
      covered: 0.6,
      escaped: 0.4,
      unknown: 0,
    });
  });

  it("splits the book's own moves by master games, and marks positions without numbers", () => {
    const result = coverage([tree([["e4", "e5"], ["d4", "d5"]])], "white", masters);
    expect(result?.covered).toBeCloseTo(0.3);
    expect(result?.escaped).toBeCloseTo(0.3);
    expect(result?.unknown).toBeCloseTo(0.4);
  });

  it("is null for a book without moves", () => {
    expect(coverage([], "white", masters)).toBeNull();
  });

  it("adds up to 1, and never drops when the book answers one more reply", () => {
    const violations: string[] = [];
    let compared = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const random = mulberry32(seed);
      const side = random() < 0.5 ? "white" : "black";
      const lookup = fakeMasters(seed);
      const book = randomBook(random);

      const before = coverage([book], side, lookup);
      if (!before) continue;
      const sum = before.covered + before.escaped + before.unknown;
      if (Math.abs(sum - 1) > 1e-9) violations.push(`seed ${seed}: shares add up to ${sum}`);

      const added = addMissingReply(book, side, lookup, random);
      if (!added) continue;
      const after = coverage([book], side, lookup)!;
      compared++;
      if (after.covered < before.covered - 1e-9) {
        violations.push(`seed ${seed}: covered fell from ${before.covered} to ${after.covered}`);
      }
    }
    expectNoViolations(violations);
    expect(compared, "books that got a reply added").toBeGreaterThan(15);
  });
});

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to 6 random lines of up to 8 plies from the start. */
function randomBook(random: () => number): MoveNode {
  const lines: string[][] = [];
  const lineCount = 1 + Math.floor(random() * 6);
  for (let i = 0; i < lineCount; i++) {
    const game = new Chess();
    const sans: string[] = [];
    const length = 1 + Math.floor(random() * 8);
    for (let ply = 0; ply < length; ply++) {
      const moves = game.moves();
      const san = moves[Math.floor(random() * Math.min(moves.length, 4))];
      game.move(san);
      sans.push(san);
    }
    lines.push(sans);
  }
  return tree(lines);
}

/** Master numbers for every legal move, made up from the position, with some positions unsaved. */
function fakeMasters(seed: number): MasterMovesLookup {
  return (key) => {
    const hash = [...`${seed}${key}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
    if (Math.abs(hash) % 7 === 0) return null;
    const game = new Chess(`${key} 0 1`);
    return game.moves({ verbose: true }).map(
      (move, index): MasterMove => ({
        uci: move.from + move.to + (move.promotion ?? ""),
        games: (Math.abs(hash) + index * 13) % 5 === 0 ? 0 : 1 + ((Math.abs(hash) >> index % 16) % 50),
      }),
    );
  };
}

/** Adds, as a leaf, a reply masters played where the other side already has a reply in the book. */
function addMissingReply(
  book: MoveNode,
  side: "white" | "black",
  lookup: MasterMovesLookup,
  random: () => number,
): boolean {
  const candidates: MoveNode[] = [];
  const walk = (node: MoveNode) => {
    const otherSideMoves = (node.fen.split(" ")[1] === "b" ? "black" : "white") !== side;
    if (otherSideMoves && node.children.length > 0) candidates.push(node);
    node.children.forEach(walk);
  };
  walk(book);
  if (candidates.length === 0) return false;

  const node = candidates[Math.floor(random() * candidates.length)];
  const missing = (lookup(toPositionKey(node.fen)) ?? []).find(
    (move) => move.games > 0 && !node.children.some((child) => child.uci === move.uci),
  );
  if (!missing) return false;

  const game = new Chess(node.fen);
  const move = game.move({
    from: missing.uci.slice(0, 2),
    to: missing.uci.slice(2, 4),
    promotion: missing.uci[4],
  });
  node.children.push({
    id: `${node.id}:${missing.uci}`,
    san: move.san,
    uci: missing.uci,
    fen: game.fen(),
    children: [],
  });
  return true;
}
