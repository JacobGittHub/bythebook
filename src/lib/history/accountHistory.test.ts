import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountHistoryFor, forgetAccountHistoryCopy } from "./accountHistory";
import { HistoryError, type HistorySummary, type ReadGame, type StoredChunk } from "./types";
import { chunkFacts, checkedCommit, emptySummary, saveImport, type ChunkFacts } from "./writes";

// The account's store against a server kept in memory, which follows the routes: chunks staged
// one request each, then a commit checked by `checkedCommit`. Each test has a copy of its own.

function game(n: number): ReadGame {
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

type Server = { summary: HistorySummary; chunks: Map<number, StoredChunk>; staged: Map<number, StoredChunk>; requests: string[] };

/** A fetch that answers as the history routes do. */
function serve(server: Server) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? "GET";
    server.requests.push(`${method} ${url}`);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    const chunk = /\/chunks\/(\d+)$/.exec(url);
    const refuse = (error: HistoryError) => Response.json({ error: error.message, code: error.code }, { status: error.code === "stale" ? 409 : 400 });
    if (chunk && method === "GET") return Response.json(server.chunks.get(Number(chunk[1])));
    if (chunk && method === "PUT") {
      if (body?.expectedVersion !== server.summary.version) return refuse(new HistoryError("stale"));
      server.staged.set(Number(chunk[1]), { n: Number(chunk[1]), games: body.games as StoredChunk["games"] });
      return new Response(null, { status: 204 });
    }
    if (method === "GET") return Response.json(server.summary);
    if (method === "DELETE") {
      server.chunks.clear();
      server.summary = { ...emptySummary(server.summary.limit), version: server.summary.version + 1 };
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && body) {
      const { expectedVersion, ...commit } = body;
      if (expectedVersion !== server.summary.version) return refuse(new HistoryError("stale"));
      const facts: ChunkFacts[] = [...server.staged.values()].map(chunkFacts);
      try {
        const checked = checkedCommit(server.summary, commit, facts, new Date());
        for (const n of checked.commit.deleted) server.chunks.delete(n);
        for (const n of checked.commit.written) server.chunks.set(n, server.staged.get(n) as StoredChunk);
        server.staged.clear();
        server.summary = checked.summary;
        return Response.json(server.summary);
      } catch (error) {
        return refuse(error as HistoryError);
      }
    }
    return new Response(null, { status: 404 });
  };
}

let count = 0;
let server: Server;
let copyName: string;
beforeEach(() => {
  server = { summary: emptySummary(10_000), chunks: new Map(), staged: new Map(), requests: [] };
  copyName = `test-account-copy-${++count}`;
  vi.stubGlobal("fetch", vi.fn(serve(server)));
});
afterEach(() => vi.unstubAllGlobals());

async function importInto(history: ReturnType<typeof accountHistoryFor>, incoming: ReadGame[]) {
  const { version } = await history.summary();
  return saveImport(history, incoming, { choice: "stop", username: "Me", version, name: "games.pgn" });
}

describe("accountHistoryFor", () => {
  it("stages each chunk, then commits them", async () => {
    const history = accountHistoryFor("user-1", copyName);
    const report = await importInto(history, games(1, 1_500));
    expect(report.added).toBe(1_500);
    expect(server.requests.filter((r) => r.startsWith("PUT")).sort()).toEqual(["PUT /api/history/chunks/0", "PUT /api/history/chunks/1"]);
    expect(server.requests.at(-1)).toBe("POST /api/history");
    expect(await history.summary()).toMatchObject({ games: 1_500, version: 1 });
  });

  it("fetches only the chunks that changed since its copy", async () => {
    const history = accountHistoryFor("user-1", copyName);
    await importInto(history, games(1, 1_500));
    server.requests.length = 0;
    expect((await history.chunks()).flatMap((chunk) => chunk.games)).toHaveLength(1_500);
    // Both chunks were copied as they were written.
    expect(server.requests.filter((r) => r.startsWith("GET /api/history/chunks"))).toEqual([]);

    // Another device adds games: only the last chunk changes.
    await importInto(accountHistoryFor("user-1", `${copyName}-other`), games(1_501, 1_600));
    server.requests.length = 0;
    expect((await history.chunks()).flatMap((chunk) => chunk.games)).toHaveLength(1_600);
    expect(server.requests.filter((r) => r.startsWith("GET /api/history/chunks"))).toEqual(["GET /api/history/chunks/1"]);
  });

  it("keeps no copy of another account's games", async () => {
    await importInto(accountHistoryFor("user-1", copyName), games(1, 10));
    server.requests.length = 0;
    await accountHistoryFor("user-2", copyName).chunks();
    expect(server.requests).toContain("GET /api/history/chunks/0");
  });

  it("fetches everything again once the copy is forgotten", async () => {
    await importInto(accountHistoryFor("user-1", copyName), games(1, 10));
    await forgetAccountHistoryCopy(copyName);
    server.requests.length = 0;
    await accountHistoryFor("user-1", copyName).chunks();
    expect(server.requests).toContain("GET /api/history/chunks/0");
  });

  it("reports a refusal with the server's code", async () => {
    const history = accountHistoryFor("user-1", copyName);
    const write = { chunks: [{ n: 0, games: games(1, 1).map((g) => ({ ...g, importId: 1 })) }], deleted: [], username: "Me", imports: [] };
    await expect(history.write(write, 5)).rejects.toMatchObject({ code: "stale" });
    await expect(history.write(write, 0)).rejects.toMatchObject({ code: "invalid" });
  });
});
