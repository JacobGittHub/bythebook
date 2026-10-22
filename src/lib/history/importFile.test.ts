import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileProblem, freshFor, importGames, likelyUser, pickGames, readText, scanFile } from "./importFile";
import { readGames } from "./pgnGames";
import { gameKey, readRecord } from "./record";
import { MAX_GAME_FILE_BYTES } from "./types";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

/** `text` as a file's stream, in pieces of `size` bytes, which may split a character. */
function streamOf(text: string, size = 64 * 1024): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
}

describe("fileProblem", () => {
  const pgn = new TextEncoder().encode("[Event");
  it("refuses empty, oversized and compressed files", () => {
    expect(fileProblem("games.pgn", 1_000, pgn)).toBeNull();
    expect(fileProblem("games.pgn", 0, pgn)).toMatch(/empty/);
    expect(fileProblem("games.pgn", MAX_GAME_FILE_BYTES + 1, pgn)).toMatch(/larger than 100 MB/);
    expect(fileProblem("games.pgn", 1_000, new Uint8Array([0x50, 0x4b, 3, 4]))).toMatch(/compressed/);
    expect(fileProblem("games.pgn", 1_000, new Uint8Array([0x1f, 0x8b, 8, 0]))).toMatch(/compressed/);
    expect(fileProblem("lichess_games.pgn.zip", 1_000, pgn)).toMatch(/compressed/);
  });
});

describe("readText", () => {
  it("joins characters split between pieces", async () => {
    const pieces: string[] = [];
    await readText(streamOf("Réti — Nimzowitsch ♞", 1), (text) => void pieces.push(text));
    expect(pieces.join("")).toBe("Réti — Nimzowitsch ♞");
  });
});

describe("scanFile", () => {
  it("counts the games, the names and the new games each could import", async () => {
    const { scan, candidates } = await scanFile(streamOf(fixture("chesscom.pgn")), new Set());
    expect(scan).toMatchObject({ games: 19, truncated: false, duplicates: 0, sources: { chesscom: 19, lichess: 0, other: 0 } });
    expect(scan.skipped).toEqual({ variant: 2, unfinished: 0, noMoves: 0, unreadable: 0 });
    expect(scan.names[0]).toEqual({ name: "FixturePlayer", games: 19, fresh: 17 });
    expect(likelyUser(scan)).toBe("FixturePlayer");
    expect(freshFor(scan, " fixtureplayer ")).toBe(17);
    expect(freshFor(scan, "nobody")).toBe(0);
    expect(candidates).toHaveLength(17);
  });

  it("reads the same in small pieces as whole", async () => {
    const text = fixture("lichess.pgn");
    expect(await scanFile(streamOf(text, 7), new Set())).toEqual(await scanFile(streamOf(text), new Set()));
  });

  it("counts stored games and games repeated in the file as duplicates", async () => {
    const text = fixture("lichess.pgn");
    const first = await gameKey(readGames(text).games[0]);
    const { scan, candidates } = await scanFile(streamOf(`${text}\n\n${text}`), new Set([first]));
    expect(scan.games).toBe(18);
    expect(candidates).toHaveLength(7);
    expect(scan.duplicates).toBe(9);
    expect(scan.names[0]).toMatchObject({ name: "DrNykterstein", games: 18, fresh: 7 });
  });
});

describe("pickGames and importGames", () => {
  it("replays only the chosen games, the newest that fit", async () => {
    const text = fixture("chesscom.pgn");
    const { candidates } = await scanFile(streamOf(text), new Set());
    const wanted = pickGames(candidates, "FixturePlayer", 5);
    const newest = [...candidates].sort((a, b) => (a.playedAt! < b.playedAt! ? -1 : 1)).slice(-5);
    expect([...wanted].sort()).toEqual(newest.map((game) => game.key).sort());

    const result = await importGames(streamOf(text), { username: "fixtureplayer", wanted, storedKeys: new Set() });
    expect(result.games.map((game) => game.record.key).sort()).toEqual([...wanted].sort());
    expect(result).toMatchObject({ leftOut: 12, duplicates: 0 });
    expect(result.skipped).toEqual({ variant: 2, unfinished: 0, player: 0, noMoves: 0, unreadable: 0 });
  });

  it("gives the same records as reading each game", async () => {
    const text = fixture("lichess.pgn");
    const { candidates } = await scanFile(streamOf(text), new Set());
    const wanted = pickGames(candidates, "DrNykterstein", 100);
    const result = await importGames(streamOf(text, 100), { username: "DrNykterstein", wanted, storedKeys: new Set() });
    const expected = [];
    for (const game of readGames(text).games) {
      const read = await readRecord(game, "DrNykterstein");
      if (read.ok) expected.push({ record: read.record, clocks: read.clocks });
    }
    expect(result.games).toEqual(expected);
  });

  it("counts the games the user didn't play, and the stored ones", async () => {
    const text = fixture("lichess.pgn");
    const stored = new Set([await gameKey(readGames(text).games[0])]);
    const someone = await importGames(streamOf(text), { username: "Someone", wanted: new Set(), storedKeys: stored });
    expect(someone.skipped.player).toBe(8);
    const me = await importGames(streamOf(text), { username: "DrNykterstein", wanted: new Set(), storedKeys: stored });
    expect(me).toMatchObject({ duplicates: 1, leftOut: 7, games: [] });
  });
});
