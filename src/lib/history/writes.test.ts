import { describe, expect, it } from "vitest";
import { HistoryError, type HistoryImport, type HistorySummary } from "./types";
import { checkedCommit, emptySummary, type ChunkFacts } from "./writes";

// An account's commit (plans/game-history.md, step 12): checked from the facts of the chunks it
// staged, by the same rules the browser's writes follow (browserHistory.test.ts).

const at = new Date("2026-10-21T12:00:00.000Z");
const imports = (games: number, id = 1): HistoryImport[] => [{ id, at: at.toISOString(), name: "games.pgn", username: "Me", games }];
const facts = (n: number, games: number, importIds = [1]): ChunkFacts => ({ n, games, importIds });

function refusal(work: () => unknown) {
  try {
    work();
  } catch (error) {
    return error instanceof HistoryError ? error.code : String(error);
  }
  return "accepted";
}

describe("checkedCommit", () => {
  it("lists each chunk with the version that wrote it", () => {
    const first = checkedCommit(emptySummary(10_000), { written: [0], deleted: [], username: "Me", imports: imports(1_000) }, [facts(0, 1_000)], at);
    expect(first.summary).toMatchObject({ games: 1_000, chunks: [{ n: 0, games: 1_000, version: 1 }], version: 1, lastImportAt: at.toISOString() });

    const next = checkedCommit(
      first.summary,
      { written: [1], deleted: [], username: "Me", imports: [...imports(1_000), ...imports(10, 2)] },
      [facts(1, 10, [2])],
      at,
    );
    expect(next.summary.chunks).toEqual([
      { n: 0, games: 1_000, version: 1 },
      { n: 1, games: 10, version: 2 },
    ]);
  });

  it("refuses a chunk that wasn't staged as stale, since the upload didn't finish", () => {
    const commit = { written: [0, 1], deleted: [], username: "Me", imports: imports(1_010) };
    expect(refusal(() => checkedCommit(emptySummary(10_000), commit, [facts(0, 1_000)], at))).toBe("stale");
  });

  it("ignores staged chunks the commit doesn't name", () => {
    const commit = { written: [0], deleted: [], username: "Me", imports: imports(5) };
    expect(checkedCommit(emptySummary(10_000), commit, [facts(0, 5), facts(1, 1_000)], at).summary.games).toBe(5);
  });

  it("holds the limit, the import list and the shape", () => {
    const current: HistorySummary = { ...emptySummary(1_000) };
    expect(refusal(() => checkedCommit(current, { written: [0, 1], deleted: [], username: "Me", imports: imports(1_001) }, [facts(0, 1_000), facts(1, 1)], at))).toBe(
      "invalid",
    );
    expect(refusal(() => checkedCommit(current, { written: [0], deleted: [], username: "Me", imports: imports(4) }, [facts(0, 5)], at))).toBe("invalid");
    expect(refusal(() => checkedCommit(current, { written: [0], deleted: [], username: "Me", imports: imports(5) }, [facts(0, 5, [2])], at))).toBe("invalid");
    expect(refusal(() => checkedCommit(current, { written: [0], deleted: [0], username: "Me", imports: imports(5) }, [facts(0, 5)], at))).toBe("invalid");
    expect(refusal(() => checkedCommit(current, { written: [0], deleted: [], username: "", imports: imports(5) }, [facts(0, 5)], at))).toBe("invalid");
    expect(refusal(() => checkedCommit(current, { written: [0], deleted: [], username: "Me", imports: imports(5), extra: 1 }, [facts(0, 5)], at))).toBe("invalid");
  });
});
