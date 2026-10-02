import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN } from "./fen";
import { getOpeningEndingAt, getOpeningForLine } from "./openingCatalog";

/** The positions after each move of a line given in SAN. */
function fensOf(...sans: string[]) {
  const chess = new Chess();
  return sans.map((san) => {
    chess.move(san);
    return chess.fen();
  });
}

describe("getOpeningEndingAt", () => {
  it("names the opening whose line ends at the position, not a longer one passing through", () => {
    const [e4, , , petrov] = fensOf("e4", "e5", "Nf3", "Nf6");
    expect(getOpeningEndingAt(e4)?.name).toBe("King's Pawn Game");
    expect(getOpeningEndingAt(petrov)?.name).toMatch(/^(Petrov's Defense|Russian Game)$/);
  });

  it("has no name for the start position or a position no opening ends at", () => {
    expect(getOpeningEndingAt(START_FEN)).toBeUndefined();
    expect(getOpeningEndingAt(fensOf("a4", "h5", "h4", "a5").at(-1)!)).toBeUndefined();
  });
});

describe("getOpeningForLine", () => {
  it("keeps the last name a line reached once it leaves the catalog", () => {
    const named = fensOf("e4", "e5", "Nf3", "Nf6");
    const beyond = fensOf("e4", "e5", "Nf3", "Nf6", "a3", "a6", "h3", "h6");
    expect(getOpeningEndingAt(beyond.at(-1)!)).toBeUndefined();
    expect(getOpeningForLine(beyond)).toEqual(getOpeningForLine(named));
    expect(getOpeningForLine(named)).toEqual(getOpeningEndingAt(named.at(-1)!));
  });

  it("is undefined for no moves", () => {
    expect(getOpeningForLine([])).toBeUndefined();
  });
});
