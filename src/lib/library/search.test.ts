import { describe, expect, it } from "vitest";
import { filterBooks } from "./search";

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
