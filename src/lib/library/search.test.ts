import { describe, expect, it } from "vitest";
import { MAX_SHELF_QUERY, WHOLE_SHELF, filterBooks, parseShelf, shelfQuery } from "./search";

const books = [
  { name: "Queen's Gambit", color: "white" as const },
  { name: "Caro-Kann Defense", color: "black" as const },
  { name: "King's  Gambit", color: "white" as const },
];

describe("filterBooks", () => {
  it("matches part of a name, ignoring case and extra spaces", () => {
    expect(filterBooks(books, "  GAMBIT ", "all").map((b) => b.name)).toEqual(["Queen's Gambit", "King's  Gambit"]);
    expect(filterBooks(books, "caro   kann", "all")).toEqual([]);
    expect(filterBooks(books, "caro-kann", "all")).toHaveLength(1);
  });

  it("filters by side, and an empty search keeps everything that side allows", () => {
    expect(filterBooks(books, "", "black").map((b) => b.name)).toEqual(["Caro-Kann Defense"]);
    expect(filterBooks(books, "", "all")).toHaveLength(3);
    expect(filterBooks(books, "gambit", "black")).toEqual([]);
  });
});

describe("the shelf's filters in an address", () => {
  it("round-trip through shelfQuery and parseShelf", () => {
    const shelves = [WHOLE_SHELF, { query: "Queen's  gambit & co", side: "white" as const, verifiedOnly: false }, { query: "", side: "black" as const, verifiedOnly: true }];
    for (const shelf of shelves) {
      const params = Object.fromEntries(new URLSearchParams(shelfQuery(shelf)));
      expect(parseShelf(params)).toEqual(shelf);
    }
    expect(shelfQuery(WHOLE_SHELF)).toBe("");
  });

  it("read anything unknown, repeated or overlong as the whole shelf's, or cut it", () => {
    expect(parseShelf({ side: "red", verified: "yes", q: ["a", "b"] })).toEqual(WHOLE_SHELF);
    expect(parseShelf({ q: "x".repeat(MAX_SHELF_QUERY + 20) }).query).toHaveLength(MAX_SHELF_QUERY);
  });
});
