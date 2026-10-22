import { describe, expect, it } from "vitest";
import { expectNoViolations } from "@/lib/regions/testShapes";
import { compareGames, makeRoom, mergeGames, toChunks } from "./merge";
import type { LimitChoice, StoredChunk, StoredGame } from "./types";

/** A game played on day `day` of 2024 (a number, so tests can count), or on no known day. */
function game(day: number | null, id = day ?? 0): StoredGame {
  const playedAt = day === null ? null : new Date(Date.UTC(2024, 0, day)).toISOString().replace(".000", "");
  return {
    record: {
      key: `lichess:${String(id).padStart(8, "0")}`,
      source: "lichess",
      id: String(id).padStart(8, "0"),
      playedAt,
      timeControl: "180+0",
      timeClass: "blitz",
      color: "white",
      result: "win",
      rating: null,
      opponentRating: null,
      moves: "e2e4",
      plies: 1,
    },
    clocks: [],
  };
}
const ids = (chunks: readonly StoredChunk[]) => chunks.flatMap((chunk) => chunk.games.map((g) => Number(g.record.id)));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => game(from + i));
/** A history holding `games` in chunks of `size`, numbered from `first`. */
const history = (games: StoredGame[], size: number, first = 0): StoredChunk[] =>
  toChunks(games, size).map((chunk, i) => ({ n: first + i, games: chunk }));

describe("mergeGames", () => {
  it("adds an import's new games after the stored ones, oldest played first, and drops duplicates", () => {
    const stored = history([game(5), game(9)], 10);
    const { chunks, report } = mergeGames(stored, [game(4), game(2), game(9), game(4)], { limit: 100, choice: "stop" });
    // Games 2 and 4 were played before 9 but imported after it, so they come after it.
    expect(ids(chunks)).toEqual([5, 9, 2, 4]);
    expect(report).toMatchObject({ added: 2, duplicates: 2, leftOut: 0, removed: 0, total: 4 });
  });

  it("puts games on no known day first within an import, then orders ties by key", () => {
    const { chunks } = mergeGames([], [game(2, 7), game(null, 9), game(2, 3)], { limit: 10, choice: "stop" });
    expect(ids(chunks)).toEqual([9, 3, 7]);
    const games = chunks.flatMap((chunk) => chunk.games);
    expect([...games].sort(compareGames)).toEqual(games);
  });

  it("stops at the limit, keeping the newest new games that fit", () => {
    const { chunks, report } = mergeGames(history(range(1, 8), 4), [game(20), game(30), game(10)], { limit: 10, choice: "stop" });
    expect(ids(chunks)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 20, 30]);
    expect(report).toMatchObject({ added: 2, leftOut: 1, removed: 0, total: 10 });
  });

  it("replaces the games imported earliest, not those played earliest", () => {
    // The first import holds games played late; the second, games played early.
    const stored = history([...range(50, 53), ...range(1, 4)], 4);
    const { chunks, report } = mergeGames(stored, range(60, 62), { limit: 8, choice: "replace" });
    expect(ids(chunks)).toEqual([53, 1, 2, 3, 4, 60, 61, 62]);
    expect(report).toMatchObject({ added: 3, leftOut: 0, removed: 3, total: 8 });
  });

  it("keeps only the newest of an import larger than the whole limit", () => {
    const { chunks, report } = mergeGames(history(range(1, 3), 2), range(10, 16), { limit: 4, choice: "replace" });
    expect(ids(chunks)).toEqual([13, 14, 15, 16]);
    expect(report).toMatchObject({ added: 4, leftOut: 3, removed: 3, total: 4, deleted: [0, 1] });
  });

  it("drops the earliest imported to meet a lowered limit, whatever the choice", () => {
    for (const choice of ["stop", "replace"] as const) {
      const { chunks, report } = mergeGames(history(range(1, 6), 3), [], { limit: 4, choice });
      expect(ids(chunks)).toEqual([3, 4, 5, 6]);
      expect(report).toMatchObject({ removed: 2, total: 4, written: [0], deleted: [] });
    }
  });

  it("rewrites only the chunks at either end, and numbers new chunks upward", () => {
    // Chunks 4, 5 and 6 of three games, the last holding one.
    const stored = history(range(1, 7), 3, 4);
    const grown = mergeGames(stored, range(8, 11), { limit: 100, choice: "stop", size: 3 });
    expect(grown.report).toMatchObject({ written: [6, 7], deleted: [] });
    expect(grown.chunks.map((chunk) => chunk.n)).toEqual([4, 5, 6, 7]);
    expect(grown.chunks[0]).toBe(stored[0]);

    const replaced = mergeGames(stored, range(8, 11), { limit: 7, choice: "replace", size: 3 });
    expect(ids(replaced.chunks)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(replaced.report).toMatchObject({ written: [5, 6, 7], deleted: [4], removed: 4 });
    expect(replaced.chunks.map((chunk) => chunk.n)).toEqual([5, 6, 7]);
  });

  it("starts after the last chunk's number when every chunk is dropped", () => {
    const { chunks, report } = mergeGames(history(range(1, 4), 2, 3), range(10, 11), { limit: 2, choice: "replace", size: 2 });
    expect(chunks).toEqual([{ n: 5, games: range(10, 11) }]);
    expect(report).toMatchObject({ written: [5], deleted: [3, 4] });
  });

  it("changes nothing with nothing new, and keeps nothing with no room", () => {
    const stored = history(range(1, 3), 2);
    expect(mergeGames(stored, range(1, 3), { limit: 10, choice: "stop" }).report).toMatchObject({
      added: 0,
      duplicates: 3,
      written: [],
      deleted: [],
    });
    expect(mergeGames(stored, [game(4)], { limit: 0, choice: "replace" }).report).toMatchObject({ total: 0, removed: 3, leftOut: 1 });
  });

  it("keeps its shape over many imports: within the limit, chunks in order, only the ends partial", () => {
    const violations: string[] = [];
    let seed = 7;
    const next = (n: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % n;
    };
    const size = 5;
    for (let run = 0; run < 30; run++) {
      let chunks: StoredChunk[] = [];
      let day = 1;
      const limit = 3 + next(20);
      for (let round = 0; round < 12; round++) {
        // Each import repeats a few stored games and adds some new ones, played at any time.
        const repeats = chunks.flatMap((chunk) => chunk.games).filter(() => next(3) === 0);
        const incoming = [...repeats, ...Array.from({ length: next(12) }, () => game(next(400), day++))];
        const choice: LimitChoice = next(2) ? "stop" : "replace";
        const before = chunks;
        const { chunks: after, report } = mergeGames(before, incoming, { limit, choice, size });
        const label = `run ${run} import ${round}`;
        const keys = after.flatMap((chunk) => chunk.games.map((g) => g.record.key));
        if (keys.length !== report.total || report.total > limit) violations.push(`${label}: ${keys.length} games, total ${report.total}, limit ${limit}`);
        if (new Set(keys).size !== keys.length) violations.push(`${label}: a game is kept twice`);
        after.forEach((chunk, i) => {
          if (i > 0 && chunk.n <= after[i - 1].n) violations.push(`${label}: chunk ${chunk.n} out of order`);
          if (!chunk.games.length || chunk.games.length > size) violations.push(`${label}: chunk ${chunk.n} holds ${chunk.games.length}`);
          if (i > 0 && i < after.length - 1 && chunk.games.length !== size) violations.push(`${label}: middle chunk ${chunk.n} isn't full`);
          const old = before.find((c) => c.n === chunk.n);
          if (!report.written.includes(chunk.n) && old !== chunk) violations.push(`${label}: chunk ${chunk.n} changed unwritten`);
        });
        for (const n of report.deleted) {
          if (after.some((chunk) => chunk.n === n)) violations.push(`${label}: chunk ${n} deleted but kept`);
        }
        chunks = after;
      }
    }
    expectNoViolations(violations);
  });
});

describe("makeRoom", () => {
  it("fits new games under the limit by the user's choice", () => {
    expect(makeRoom(8, 5, 10, "stop")).toEqual({ keep: 2, drop: 0 });
    expect(makeRoom(8, 5, 10, "replace")).toEqual({ keep: 5, drop: 3 });
    expect(makeRoom(8, 2, 10, "replace")).toEqual({ keep: 2, drop: 0 });
    expect(makeRoom(8, 50, 10, "replace")).toEqual({ keep: 10, drop: 8 });
    expect(makeRoom(12, 3, 10, "stop")).toEqual({ keep: 0, drop: 2 });
  });
});

describe("toChunks", () => {
  it("splits games into chunks in order", () => {
    expect(toChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(toChunks([], 2)).toEqual([]);
  });
});
