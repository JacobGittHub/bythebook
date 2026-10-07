// Grows a book from master statistics (plans/bookstore.md, Q1): from a root line, the book's
// own side plays its most played move and the other side gets every reply masters played
// often enough, breadth first, until a depth or the position limit. The numbers come from a
// lookup, which `npm run books:examples` answers from `position_cache` without calling
// Lichess, so where the cache stops the book stops. Pure apart from the lookup.

import { Chess } from "chess.js";
import { START_FEN } from "@/lib/chess/fen";
import type { BookSide } from "@/lib/books/measures";

export type GrowRules = {
  /** SAN moves from the starting position: the book's first line, before any choice. */
  root: readonly string[];
  side: BookSide;
  /** A reply by the other side is kept when at least this share of the position's games played it… */
  minShare: number;
  /** …and at least this many games did. */
  minGames: number;
  /** No position deeper than this ply is added. */
  maxPly: number;
  maxPositions: number;
  /**
   * Lines that start the book before it grows, as SAN from the start, such as the catalog's
   * named lines ("catalog+masters"). Each of their leaves is grown from.
   */
  seedLines?: readonly string[];
};

/** A position's master moves with their game counts, and every game in it, or null when unknown. */
export type GrowLookup = (
  fen: string,
) => Promise<{ moves: readonly { uci: string; games: number }[]; total: number } | null>;

export type GrowResult = {
  lines: string[];
  positions: number;
  /** Positions the lookup had no numbers for, where a line stopped early. */
  unknown: number;
  /** True when the position limit cut the book short. */
  full: boolean;
};

type Item = { fen: string; sans: string[] };

function sideOf(fen: string): BookSide {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

/** The SAN and position after a UCI move, or null when it is illegal there. */
function play(fen: string, uci: string): { san: string; fen: string } | null {
  try {
    const game = new Chess(fen);
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { san: move.san, fen: game.fen() };
  } catch {
    return null;
  }
}

function replay(sans: readonly string[]): Item | null {
  const game = new Chess(START_FEN);
  const played: string[] = [];
  try {
    for (const san of sans) played.push(game.move(san).san);
  } catch {
    return null;
  }
  return { fen: game.fen(), sans: played };
}

export async function growBook(rules: GrowRules, lookup: GrowLookup): Promise<GrowResult> {
  const start = replay(rules.root);
  if (!start) throw new Error(`The root line "${rules.root.join(" ")}" isn't legal.`);

  // The tree so far, as children by SAN, keyed by the line that reaches each position.
  const children = new Map<string, Set<string>>();
  const key = (sans: readonly string[]) => sans.join(" ");
  let positions = 0;
  const add = (sans: readonly string[]) => {
    for (let i = 0; i < sans.length; i++) {
      const parent = key(sans.slice(0, i));
      const known = children.get(parent) ?? new Set<string>();
      if (!known.has(sans[i])) {
        known.add(sans[i]);
        children.set(parent, known);
        positions++;
      }
    }
  };

  add(start.sans);
  for (const line of rules.seedLines ?? []) {
    const seed = replay(line.split(/\s+/).filter(Boolean));
    if (seed && key(seed.sans.slice(0, start.sans.length)) === key(start.sans)) add(seed.sans);
  }

  // Breadth first from the root line's position, through the seeded moves as well, so the
  // limit cuts the deepest positions first. Where the seeds already give the book's own side
  // a move, it keeps that move; the other side still gets any common reply they lack.
  let unknown = 0;
  let full = positions >= rules.maxPositions;
  const queue: Item[] = [start];
  while (queue.length) {
    const item = queue.shift()!;
    const known = children.get(key(item.sans)) ?? new Set<string>();
    if (!full && item.sans.length < rules.maxPly) {
      const data = await lookup(item.fen);
      if (!data || data.total === 0) {
        if (!known.size) unknown++;
      } else {
        const sorted = [...data.moves].sort((a, b) => b.games - a.games || a.uci.localeCompare(b.uci));
        const own = sideOf(item.fen) === rules.side;
        const chosen = own
          ? known.size
            ? []
            : sorted.slice(0, 1).filter((move) => move.games >= rules.minGames)
          : sorted.filter((move) => move.games >= rules.minGames && move.games / data.total >= rules.minShare);
        for (const move of chosen) {
          const next = play(item.fen, move.uci);
          if (!next || known.has(next.san)) continue;
          if (positions + 1 > rules.maxPositions) {
            full = true;
            break;
          }
          add([...item.sans, next.san]);
        }
      }
    }
    for (const san of children.get(key(item.sans)) ?? []) {
      const next = replay([...item.sans, san]);
      if (next) queue.push(next);
    }
  }

  const leaves = (sans: string[]): string[][] => {
    const next = [...(children.get(key(sans)) ?? [])];
    return next.length ? next.flatMap((san) => leaves([...sans, san])) : [sans];
  };
  return { lines: leaves([]).map((sans) => sans.join(" ")).filter(Boolean), positions, unknown, full };
}
