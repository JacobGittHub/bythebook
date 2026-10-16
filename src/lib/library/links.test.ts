import { describe, expect, it } from "vitest";
import { MAX_LINE_MOVES, bookstoreHref, explorerHref, libraryHref, parseLineParam, replayUciLine, storeBookHref, storeIdOfSlug } from "./links";
import { WHOLE_SHELF } from "./search";

describe("explorerHref", () => {
  it("names the book and the line's moves, skipping the first position", () => {
    const line = [{ uci: null }, { uci: "d2d4" }, { uci: "d7d5" }];
    expect(explorerHref({ bookId: "abc", line })).toBe("/dashboard/explorer?book=abc&line=d2d4%2Cd7d5");
    expect(explorerHref({})).toBe("/dashboard/explorer");
    expect(explorerHref({ line: [{ uci: null }] })).toBe("/dashboard/explorer");
  });

  it("round-trips through parseLineParam", () => {
    const href = explorerHref({ line: [{ uci: null }, { uci: "e2e4" }, { uci: "e7e8q" }] });
    const params = new URL(href, "https://x.test").searchParams;
    expect(parseLineParam(params.get("line"))).toEqual(["e2e4", "e7e8q"]);
  });
});

describe("libraryHref", () => {
  it("picks the book given, or none", () => {
    expect(libraryHref("a b")).toBe("/dashboard/library?book=a%20b");
    expect(libraryHref(null)).toBe("/dashboard/library");
    expect(libraryHref()).toBe("/dashboard/library");
  });
});

describe("parseLineParam", () => {
  it("stops at the first move that isn't UCI", () => {
    expect(parseLineParam("e2e4,e7e5,Nf3,g1f3")).toEqual(["e2e4", "e7e5"]);
    expect(parseLineParam("")).toEqual([]);
    expect(parseLineParam(null)).toEqual([]);
  });

  it("reads at most MAX_LINE_MOVES moves", () => {
    expect(parseLineParam(Array(MAX_LINE_MOVES + 5).fill("e2e4").join(","))).toHaveLength(MAX_LINE_MOVES);
  });
});

describe("store book addresses", () => {
  it("drop the example prefix and get it back", () => {
    expect(storeBookHref("example:queens-gambit")).toBe("/dashboard/bookstore/queens-gambit");
    expect(storeIdOfSlug("queens-gambit")).toBe("example:queens-gambit");
  });

  it("carry the shelf's search and filters, and nothing for the whole shelf", () => {
    const shelf = { query: "caro kann", side: "black" as const, verifiedOnly: true };
    expect(bookstoreHref(shelf)).toBe("/dashboard/bookstore?q=caro+kann&side=black&verified=1");
    expect(storeBookHref("example:caro-kann-defense", shelf)).toBe("/dashboard/bookstore/caro-kann-defense?q=caro+kann&side=black&verified=1");
    expect(bookstoreHref(WHOLE_SHELF)).toBe("/dashboard/bookstore");
    expect(bookstoreHref()).toBe("/dashboard/bookstore");
  });
});

describe("replayUciLine", () => {
  it("replays legal moves into SAN and stops at the first illegal one", () => {
    expect(replayUciLine(["d2d4", "d7d5", "c2c4"]).map((move) => move.san)).toEqual(["d4", "d5", "c4"]);
    expect(replayUciLine(["e2e4", "e2e4", "e7e5"]).map((move) => move.san)).toEqual(["e4"]);
    expect(replayUciLine([])).toEqual([]);
  });
});
