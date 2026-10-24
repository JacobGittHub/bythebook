import { describe, expect, it } from "vitest";
import {
  ALL_GAMES,
  chooseGames,
  controlName,
  dateSummary,
  isAllGames,
  monthStrip,
  recentGames,
  sourceGroups,
  sourceSummary,
  timeGroups,
  timeSummary,
  withKeys,
  type HistoryFilter,
  type HistoryGame,
} from "./historyFilter";
import type { GameRecord, HistoryImport } from "./types";

let made = 0;
function game(over: Partial<GameRecord>, importId = 1): HistoryGame {
  const id = String(++made).padStart(8, "0");
  return {
    importId,
    record: {
      key: `lichess:${id}`,
      source: "lichess",
      id,
      playedAt: "2025-03-10",
      timeControl: "180+2",
      timeClass: "blitz",
      color: "white",
      result: "win",
      rating: null,
      opponentRating: null,
      moves: "e2e4",
      plies: 1,
      ...over,
    },
  };
}

const imports: HistoryImport[] = [
  { id: 1, at: "2026-10-02T10:00:00.000Z", name: "lichess.pgn", username: "Me", games: 3 },
  { id: 2, at: "2026-10-21T10:00:00.000Z", name: "chesscom.pgn", username: "Me", games: 2 },
];
const games = [
  game({ color: "white" }),
  game({ color: "black", timeControl: "600+0", timeClass: "rapid", playedAt: "2025-05-01" }),
  game({ color: "white", timeControl: "60+0", timeClass: "bullet", playedAt: null }),
  game({ source: "chesscom", key: "chesscom:live/1", id: "live/1", color: "black", playedAt: "2025-07-20" }, 2),
  game({ source: "chesscom", key: "chesscom:live/2", id: "live/2", timeControl: "1/86400", timeClass: "daily", playedAt: "2025-04-02" }, 2),
];

describe("choosing games", () => {
  it("takes every game until something is left out, and both sides by default", () => {
    expect(chooseGames(games, ALL_GAMES)).toHaveLength(5);
    expect(isAllGames(ALL_GAMES)).toBe(true);
    expect(chooseGames(games, { ...ALL_GAMES, side: "black" })).toHaveLength(2);
  });

  it("leaves out time controls, imports and months outside the span", () => {
    const filter: HistoryFilter = { ...ALL_GAMES, offTimes: new Set(["blitz 180+2"]), offSources: new Set(["chesscom 2"]), from: "2025-04", to: null };
    expect(chooseGames(games, filter).map((g) => g.record.timeClass)).toEqual(["rapid"]);
    expect(isAllGames(filter)).toBe(false);
  });

  it("opens on the last 12 months up to the newest game, or every game when they span no more", () => {
    expect(recentGames(games)).toEqual(ALL_GAMES);
    const older = [...games, game({ key: "lichess:old", id: "old", playedAt: "2023-11-30" }), game({ key: "lichess:new", id: "new", playedAt: "2026-01-05" })];
    expect(recentGames(older)).toEqual({ ...ALL_GAMES, from: "2025-02" });
    expect(chooseGames(older, recentGames(older)).map((g) => g.record.playedAt)).toEqual(["2025-03-10", "2025-05-01", "2025-07-20", "2025-04-02", "2026-01-05"]);
    expect(recentGames([game({ playedAt: null })])).toEqual(ALL_GAMES);
  });

  it("puts keys back in and leaves them out", () => {
    const off = withKeys(new Set(["a"]), ["a", "b"], false);
    expect([...off].sort()).toEqual(["a", "b"]);
    expect([...withKeys(off, ["a"], true)]).toEqual(["b"]);
  });
});

describe("the panels", () => {
  it("group time controls by class, shortest first, counted under the other choices", () => {
    const groups = timeGroups(games, { ...ALL_GAMES, side: "white" });
    expect(groups.map((g) => [g.label, g.games])).toEqual([["Bullet", 1], ["Blitz", 1], ["Rapid", 0], ["Daily", 1]]);
    expect(groups[1].options).toEqual([{ key: "blitz 180+2", label: "3+2", games: 1 }]);
    // A filter on time doesn't change the time panel's own counts.
    expect(timeGroups(games, { ...ALL_GAMES, offTimes: new Set(["blitz 180+2"]) })[1].games).toBe(2);
  });

  it("group imports by source, newest import first, named by when and which file", () => {
    const groups = sourceGroups(games, imports, ALL_GAMES);
    expect(groups.map((g) => [g.label, g.games])).toEqual([["Chess.com", 2], ["Lichess", 3]]);
    expect(groups[0].options[0]).toEqual({ key: "chesscom 2", label: "Imported 21 Oct 2026", note: "chesscom.pgn", games: 2 });
  });

  it("strip the months from the first game to the last, with their games", () => {
    expect(monthStrip(games, ALL_GAMES)).toEqual({ months: ["2025-03", "2025-04", "2025-05", "2025-06", "2025-07"], games: [1, 1, 1, 0, 1] });
  });
});

describe("what the buttons say", () => {
  const time = timeGroups(games, ALL_GAMES);
  const sources = sourceGroups(games, imports, ALL_GAMES);

  it("names the time controls chosen", () => {
    expect(timeSummary(time, new Set())).toBe("All time controls");
    expect(timeSummary(time, new Set(["bullet 60+0", "daily 1/86400"]))).toBe("Blitz, Rapid");
    expect(timeSummary(time, new Set(time.flatMap((g) => g.options.map((o) => o.key))))).toBe("No time controls");
  });

  it("names the sources chosen, or counts the imports", () => {
    expect(sourceSummary(sources, new Set())).toBe("All sources");
    expect(sourceSummary(sources, new Set(["chesscom 2"]))).toBe("Lichess");
    expect(sourceSummary([{ label: "Lichess", games: 3, options: [{ key: "a", label: "", games: 1 }, { key: "b", label: "", games: 2 }] }], new Set(["a"]))).toBe("1 of 2 imports");
  });

  it("names the span of months", () => {
    expect(dateSummary(ALL_GAMES)).toBe("All dates");
    expect(dateSummary({ ...ALL_GAMES, from: "2025-03" })).toBe("Since Mar 2025");
    expect(dateSummary({ ...ALL_GAMES, from: "2025-03", to: "2025-06" })).toBe("Mar 2025 – Jun 2025");
  });

  it("writes time controls as players say them", () => {
    expect(controlName("180+2")).toBe("3+2");
    expect(controlName("45+0")).toBe("45s+0");
    expect(controlName("1/86400")).toBe("1 day a move");
    expect(controlName(null)).toBe("No clock");
  });
});
