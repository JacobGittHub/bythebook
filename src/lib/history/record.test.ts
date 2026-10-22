import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readGames, type RawGame } from "./pgnGames";
import { gameKey, gameLink, gameSource, playedAt, readRecord, timeSpent, type RecordRead } from "./record";
import { parseTimeControl } from "./timeControl";
import { gameClocksSchema, gameRecordSchema, GAME_HISTORY_PLIES } from "./types";

const fixture = (name: string) => readGames(readFileSync(join(__dirname, "fixtures", name), "utf8")).games;
const headers = (entries: Record<string, string>) => new Map(Object.entries(entries));
const one = (pgn: string) => readGames(pgn).games[0];
const kept = (read: RecordRead) => {
  if (!read.ok) throw new Error(`skipped: ${read.reason}`);
  return read;
};

async function readAll(games: RawGame[], username: string) {
  return Promise.all(games.map((game) => readRecord(game, username)));
}

describe("readRecord on the fixtures", () => {
  it("keeps the user's Chess.com games and skips Chess960 and set-up positions", async () => {
    const reads = await readAll(fixture("chesscom.pgn"), "fixtureplayer");
    const skipped = reads.flatMap((read) => (read.ok ? [] : [read.reason]));
    expect(skipped).toEqual(["variant", "variant"]);
    const records = reads.flatMap((read) => (read.ok ? [read.record] : []));
    expect(records.every((record) => record.source === "chesscom" && record.id !== null)).toBe(true);
    expect(new Set(records.map((record) => record.key)).size).toBe(records.length);
    expect(records.filter((record) => record.timeClass === "daily")).toHaveLength(2);
  });

  it("keeps the Lichess games, filing one without a clock by its event", async () => {
    const reads = await readAll(fixture("lichess.pgn"), "DrNykterstein");
    expect(reads.filter((read) => !read.ok)).toEqual([{ ok: false, reason: "variant" }]);
    const correspondence = kept(reads.find((read) => read.ok && read.record.timeControl === null)!);
    expect(correspondence.record.timeClass).toBe("daily");
    expect(correspondence.clocks).toEqual([]);
  });

  it("makes records and clocks that pass their schemas", async () => {
    const reads = [
      ...(await readAll(fixture("chesscom.pgn"), "FixturePlayer")),
      ...(await readAll(fixture("lichess.pgn"), "DrNykterstein")),
    ];
    for (const read of reads) {
      if (!read.ok) continue;
      expect(gameRecordSchema.safeParse(read.record).error).toBeUndefined();
      expect(gameClocksSchema.safeParse(read.clocks).error).toBeUndefined();
      const plies = read.record.moves.split(" ").length;
      expect(plies).toBe(Math.min(GAME_HISTORY_PLIES, read.record.plies));
      expect([0, plies]).toContain(read.clocks.length);
    }
  });

  it("reads the first Chess.com game whole", async () => {
    const { record, clocks } = kept(await readRecord(fixture("chesscom.pgn")[0], "FixturePlayer"));
    expect(record).toEqual({
      key: "chesscom:live/1000000001",
      source: "chesscom",
      id: "live/1000000001",
      playedAt: "2023-10-07T13:44:01Z",
      timeControl: "300+0",
      timeClass: "blitz",
      color: "white",
      result: "win",
      rating: 961,
      opponentRating: 804,
      moves: "f2f4 d7d6 e2e4",
      plies: 3,
    });
    // Clocks of 4:59.9, 4:39.9 and 4:58.4 from five minutes.
    expect(clocks).toEqual([1, 201, 15]);
  });
});

describe("readRecord on hand-written games", () => {
  const game = (tags: string, moves = "1. e4 e5 2. Nf3 Nc6") => one(`${tags}\n\n${moves} *`);

  it("reads the result from the user's side, whatever the name's case", async () => {
    const tags = (result: string) => `[White "Me"] [Black "Them"] [Result "${result}"]`;
    expect(kept(await readRecord(game(tags("1-0")), "me")).record).toMatchObject({ color: "white", result: "win" });
    expect(kept(await readRecord(game(tags("1-0")), "THEM")).record).toMatchObject({ color: "black", result: "loss" });
    expect(kept(await readRecord(game(tags("1/2-1/2")), "them")).record.result).toBe("draw");
  });

  it("says why a game is skipped", async () => {
    const tags = '[White "Me"] [Black "Them"]';
    const reason = async (text: string, username = "Me") => {
      const read = await readRecord(one(text), username);
      return read.ok ? null : read.reason;
    };
    expect(await reason(`${tags} [Result "*"]\n1. e4 *`)).toBe("unfinished");
    expect(await reason(`${tags}\n1. e4 *`)).toBe("unfinished");
    expect(await reason(`${tags} [Result "1-0"]\n1. e4 1-0`, "Someone")).toBe("player");
    expect(await reason(`${tags} [Result "1-0"]\n1-0`)).toBe("noMoves");
    expect(await reason(`${tags} [Result "1-0"]\n1. e4 e5 2. Ke3 1-0`)).toBe("unreadable");
    expect(await reason(`${tags} [Result "1-0"]\n1. e4 (1. d4 1-0`)).toBe("unreadable");
    expect(await reason(`${tags} [Result "1-0"] [Variant "Chess960"]\n1. e4 1-0`)).toBe("variant");
    expect(await reason(`${tags} [Result "1-0"] [Variant "From Position"]\n1. e4 1-0`)).toBe("variant");
    expect(await reason(`${tags} [Result "1-0"] [SetUp "1"]\n1. e4 1-0`)).toBe("variant");
  });

  it("keeps no ratings that aren't plausible", async () => {
    const tags = '[White "Me"] [Black "Them"] [Result "1-0"] [WhiteElo "?"] [BlackElo "99999"]';
    expect(kept(await readRecord(game(tags), "Me")).record).toMatchObject({ rating: null, opponentRating: null });
  });

  it("keeps only the first plies of a long game, and its full length", async () => {
    const moves = "1. Nf3 Nf6 2. Ng1 Ng8 ".repeat(20);
    const { record } = kept(await readRecord(game('[White "Me"] [Result "1-0"]', moves), "Me"));
    expect(record.moves.split(" ")).toHaveLength(GAME_HISTORY_PLIES);
    expect(record.plies).toBe(80);
  });
});

describe("gameSource and gameLink", () => {
  it("takes ids only in their expected forms", () => {
    expect(gameSource(headers({ Site: "Chess.com", Link: "https://www.chess.com/game/daily/123" }))).toEqual({
      source: "chesscom",
      id: "daily/123",
    });
    expect(gameSource(headers({ Site: "Chess.com", Link: "https://www.chess.com/live/game/456" })).id).toBe("live/456");
    expect(gameSource(headers({ Site: "Chess.com", Link: "https://www.chess.com/game/live/1?x=<script>" })).id).toBeNull();
    expect(gameSource(headers({ Site: "https://lichess.org/abcdEFGHijkl" }))).toEqual({ source: "lichess", id: "abcdEFGH" });
    expect(gameSource(headers({ Site: "https://lichess.org/study/abc", GameId: "x" })).id).toBeNull();
    expect(gameSource(headers({ Site: "javascript:alert(1)", Link: "javascript:alert(1)" }))).toEqual({
      source: "other",
      id: null,
    });
  });

  it("builds links from ids, never from headers", () => {
    expect(gameLink({ source: "chesscom", id: "live/42", color: "white" })).toBe("https://www.chess.com/game/live/42");
    expect(gameLink({ source: "lichess", id: "abcdEFGH", color: "black" })).toBe("https://lichess.org/abcdEFGH/black");
    expect(gameLink({ source: "lichess", id: "abcdEFGH", color: "white" })).toBe("https://lichess.org/abcdEFGH");
    expect(gameLink({ source: "other", id: null, color: "white" })).toBeNull();
    expect(gameLink({ source: "lichess", id: "javascript:x", color: "white" })).toBeNull();
  });
});

describe("gameKey", () => {
  const otb = '[Date "2024.03.01"] [Round "3"] [White "A"] [Black "B"] [Result "1-0"]';

  it("hashes a game without an id, the same each time it is read", async () => {
    const key = await gameKey(one(`${otb}\n1. e4 e5 1-0`));
    expect(key).toMatch(/^hash:[0-9a-f]{32}$/);
    expect(await gameKey(one(`${otb}\n\n1. e4 {a comment} e5 1-0`))).toBe(key);
    expect(await gameKey(one(`${otb}\n1. e4 c5 1-0`))).not.toBe(key);
    expect(await gameKey(one(otb.replace("Round \"3\"", "Round \"4\"") + "\n1. e4 e5 1-0"))).not.toBe(key);
  });

  it("tells apart games that differ only after the kept plies, by their length", async () => {
    const opening = "1. Nf3 Nf6 2. Ng1 Ng8 ".repeat(GAME_HISTORY_PLIES / 4);
    const short = await gameKey(one(`${otb}\n${opening} 1-0`));
    expect(await gameKey(one(`${otb}\n${opening} 21. e4 1-0`))).not.toBe(short);
  });

  it("uses the site's id when there is one", async () => {
    expect(await gameKey(one('[Site "https://lichess.org/abcdEFGH"]\n1. e4 *'))).toBe("lichess:abcdEFGH");
  });
});

describe("playedAt", () => {
  it("prefers the UTC date and time, then the date alone", () => {
    expect(playedAt(headers({ UTCDate: "2020.05.22", UTCTime: "05:21:06" }))).toBe("2020-05-22T05:21:06Z");
    expect(playedAt(headers({ UTCDate: "2020.05.22", UTCTime: "25:00:00" }))).toBe("2020-05-22");
    expect(playedAt(headers({ Date: "1999.12.31" }))).toBe("1999-12-31");
    expect(playedAt(headers({ Date: "2020.??.??" }))).toBeNull();
    expect(playedAt(headers({ Date: "2020.13.01" }))).toBeNull();
  });
});

describe("timeSpent", () => {
  it("adds the increment back, as Chess.com's clocks include it", () => {
    // 180+2: 3:01.9 after White's first move is a tenth spent.
    expect(timeSpent([1819, 1798, 1811], parseTimeControl("180+2"), "chesscom")).toEqual([1, 22, 28]);
  });

  it("counts Lichess's first moves as none, berserk or not", () => {
    expect(timeSpent([900, 1800, 880, 1790], parseTimeControl("180+0"), "lichess")).toEqual([0, 0, 20, 10]);
  });

  it("has no times without a clock, or with any clock missing", () => {
    expect(timeSpent([100, 90], parseTimeControl("1/86400"), "chesscom")).toEqual([]);
    expect(timeSpent([100, null], parseTimeControl("60"), "chesscom")).toEqual([]);
    expect(timeSpent([100, 90], null, "other")).toEqual([]);
  });
});
