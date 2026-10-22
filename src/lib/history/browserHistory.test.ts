import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { browserHistoryNamed, onBrowserHistoryChange } from "./browserHistory";
import { freshFor, importGames, pickGames, scanFile } from "./importFile";
import { makeRoom } from "./merge";
import { HistoryError, type GameHistoryStore, type StoredGame } from "./types";
import { chunkCap, saveImport } from "./writes";

// The browser's game history on an IndexedDB that lives in memory (fake-indexeddb), each test
// with a database of its own.

let count = 0;
const fresh = (limit?: number) => browserHistoryNamed(`test-history-${++count}`, limit);

function game(n: number): StoredGame {
  const id = String(n).padStart(8, "0");
  return {
    record: {
      key: `lichess:${id}`,
      source: "lichess",
      id,
      playedAt: "2024-01-01",
      timeControl: "180+0",
      timeClass: "blitz",
      color: "white",
      result: "win",
      rating: null,
      opponentRating: null,
      moves: "e2e4 e7e5",
      plies: 2,
    },
    clocks: [12, 30],
  };
}
const games = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => game(from + i));

async function refusal(work: Promise<unknown>) {
  try {
    await work;
  } catch (error) {
    return error instanceof HistoryError ? error.code : String(error);
  }
  return "accepted";
}

/** Merges `incoming` into `history` and writes the change, as an import does. */
async function importInto(history: GameHistoryStore, incoming: StoredGame[], choice: "stop" | "replace" = "stop") {
  const { version } = await history.summary();
  return saveImport(history, incoming, { choice, username: "Me", version });
}

const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

describe("the browser's game history", () => {
  it("starts empty, and keeps what is written", async () => {
    const history = fresh();
    expect(await history.summary()).toMatchObject({ games: 0, chunks: [], version: 0, username: null });
    await importInto(history, games(1, 3));
    expect(await history.summary()).toMatchObject({ games: 3, chunks: [{ n: 0, games: 3 }], version: 1, username: "Me" });
    expect((await history.chunks())[0].games).toEqual(games(1, 3));
  });

  it("refuses a write planned from an older version", async () => {
    const history = fresh();
    await importInto(history, games(1, 3));
    const write = { chunks: [{ n: 1, games: games(4, 4) }], deleted: [], username: "Me" };
    expect(await refusal(history.write(write, 0))).toBe("stale");
    expect(await refusal(saveImport(history, games(5, 5), { choice: "stop", username: "Me", version: 0 }))).toBe("stale");
    expect(await refusal(history.write(write, 1))).toBe("accepted");
  });

  it("refuses more games than the limit, and records that don't pass their schema", async () => {
    const history = fresh(3);
    expect(await refusal(history.write({ chunks: [{ n: 0, games: games(1, 4) }], deleted: [], username: "Me" }, 0))).toBe("invalid");
    const bad = { ...game(1), record: { ...game(1).record, key: "javascript:alert(1)" } };
    expect(await refusal(history.write({ chunks: [{ n: 0, games: [bad] }], deleted: [], username: "Me" }, 0))).toBe("invalid");
    const noName = { chunks: [{ n: 0, games: games(1, 1) }], deleted: [], username: " " };
    expect(await refusal(history.write(noName, 0))).toBe("invalid");
    expect(await history.summary()).toMatchObject({ games: 0, version: 0 });
  });

  it("refuses more chunks than the limit needs", async () => {
    const history = fresh(1_000);
    const chunks = Array.from({ length: chunkCap(1_000) + 1 }, (_, n) => ({ n, games: games(n, n) }));
    expect(await refusal(history.write({ chunks, deleted: [], username: "Me" }, 0))).toBe("invalid");
  });

  it("deletes chunks, and empties with the version still counting", async () => {
    const history = fresh(4);
    await importInto(history, games(1, 4));
    const report = await importInto(history, games(5, 6), "replace");
    expect(report).toMatchObject({ removed: 2, total: 4 });
    expect(await history.summary()).toMatchObject({ games: 4, version: 2 });
    await history.clear();
    expect(await history.summary()).toMatchObject({ games: 0, chunks: [], version: 3 });
    expect(await history.chunks()).toEqual([]);
  });

  it("tells the browser's tabs when it changes", async () => {
    const name = `test-history-${++count}`;
    const history = browserHistoryNamed(name);
    let heard = 0;
    stops.push(onBrowserHistoryChange(() => heard++, name));
    await importInto(history, games(1, 2));
    await history.clear();
    await expect.poll(() => heard).toBe(2);
  });
});

describe("a guest's import, from file to store", () => {
  const text = readFileSync(join(__dirname, "fixtures", "chesscom.pgn"), "utf8");
  const stream = () => new Blob([text]).stream();

  /** Both passes and the write, keeping at most `room` games, stopping or replacing past it. */
  async function importFile(history: GameHistoryStore, choice: "stop" | "replace" = "stop") {
    const [summary, chunks] = await Promise.all([history.summary(), history.chunks()]);
    const storedKeys = new Set(chunks.flatMap((chunk) => chunk.games.map((g) => g.record.key)));
    const { scan, candidates } = await scanFile(stream(), storedKeys);
    const { keep } = makeRoom(summary.games, freshFor(scan, "FixturePlayer"), summary.limit, choice);
    const wanted = pickGames(candidates, "FixturePlayer", keep);
    const result = await importGames(stream(), { username: "FixturePlayer", wanted, storedKeys });
    return { scan, result, report: await importInto(history, result.games, choice) };
  }

  it("keeps the user's games, and finds them all stored the second time", async () => {
    const history = fresh();
    const first = await importFile(history);
    expect(first.report).toMatchObject({ added: 17, total: 17 });
    const second = await importFile(history);
    expect(second.scan).toMatchObject({ duplicates: 17 });
    expect(second.result.games).toEqual([]);
    // Nothing changed, so nothing was written.
    expect(await history.summary()).toMatchObject({ games: 17, version: 1 });
  });

  it("fills the room left and stops, or replaces the earliest imported", async () => {
    const history = fresh(20);
    await importInto(history, games(1, 10));
    const stopped = await importFile(history, "stop");
    expect(stopped.result).toMatchObject({ leftOut: 7 });
    expect(stopped.report).toMatchObject({ added: 10, removed: 0, total: 20 });

    const other = fresh(20);
    await importInto(other, games(1, 10));
    const replaced = await importFile(other, "replace");
    expect(replaced.report).toMatchObject({ added: 17, removed: 7, total: 20 });
    const kept = (await other.chunks()).flatMap((chunk) => chunk.games.map((g) => g.record.key));
    expect(kept.slice(0, 3)).toEqual(["lichess:00000008", "lichess:00000009", "lichess:00000010"]);
  });
});
