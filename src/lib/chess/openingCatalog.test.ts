import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN } from "./fen";
import { getCatalogLineToFen, getOpeningEndingAt, getOpeningForLine } from "./openingCatalog";

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

describe("getCatalogLineToFen", () => {
  it("stops at the position, though longer named lines pass through it", () => {
    const [, sicilian] = fensOf("e4", "c5");
    expect(getCatalogLineToFen(sicilian).map((move) => move.san)).toEqual(["e4", "c5"]);
  });

  it("reaches a position from a transposition by a named line's own order", () => {
    const fens = fensOf("Nf3", "d5", "d4");
    const line = getCatalogLineToFen(fens[2]);
    const chess = new Chess();
    for (const move of line) chess.move(move.san);
    expect(chess.fen().split(" ").slice(0, 4)).toEqual(fens[2].split(" ").slice(0, 4));
  });

  it("is empty for the start and for a position no named line reaches", () => {
    expect(getCatalogLineToFen(START_FEN)).toEqual([]);
    expect(getCatalogLineToFen(fensOf("a3", "h6", "Ra2", "Rh7")[3])).toEqual([]);
  });
});
