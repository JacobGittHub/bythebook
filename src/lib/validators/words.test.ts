import { describe, expect, it } from "vitest";
import catalog from "@/lib/chess/generated/openingCatalogIndex.json";
import { hasBannedWords, joinSpacedLetters } from "./words";

describe("the word list", () => {
  it("refuses banned words, however they are spelled", () => {
    for (const text of ["shit", "Sh1t opening", "fuuuck", "f u c k", "s.h.i.t", "s_h_i_t", "ＳＨＩＴ"]) {
      expect(hasBannedWords(text), text).toBe(true);
    }
  });

  it("passes chess talk and words that only contain a banned one", () => {
    const fine = [
      "Scunthorpe",
      "assassin",
      "Kill the king",
      "Sacrifice the queen",
      "Fried Liver Attack",
      "Hippopotamus",
      "ByTheBook",
      "I play a b c d pawns",
    ];
    for (const text of fine) expect(hasBannedWords(text), text).toBe(false);
  });

  it("passes every opening name in the catalog", () => {
    const refused = catalog.openings.map((opening) => opening.name).filter(hasBannedWords);
    expect(refused).toEqual([]);
  });

  it("joins only runs of three or more single letters", () => {
    expect(joinSpacedLetters("f u c k you")).toBe("fuck you");
    expect(joinSpacedLetters("a b")).toBe("a b");
    expect(joinSpacedLetters("Play e4 e5")).toBe("Play e4 e5");
  });
});
