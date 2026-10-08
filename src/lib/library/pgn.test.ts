import { describe, expect, it } from "vitest";
import { countPositions } from "@/lib/books/measures";
import { START_FEN } from "@/lib/chess/fen";
import { MAX_PGN_CHARS, pgnTrees, readPgn } from "./pgn";

const sans = (read: ReturnType<typeof readPgn>) => (read.ok ? read.lines.map((line) => line.map((m) => m.san).join(" ")) : []);

describe("readPgn", () => {
  it("reads plain moves, with or without numbers", () => {
    expect(sans(readPgn("e4 e5 Nf3"))).toEqual(["e4 e5 Nf3"]);
    expect(sans(readPgn("1. e4 e5 2.Nf3 Nc6 3.Bb5 3...a6"))).toEqual(["e4 e5 Nf3 Nc6 Bb5 a6"]);
  });

  it("makes each variation its own line, from the position before the move it replaces", () => {
    const read = readPgn("1. e4 c5 2. Nf3 d6 (2... Nc6 3. d4) (2... e6) 3. d4 cxd4");
    expect(sans(read)).toEqual(["e4 c5 Nf3 d6 d4 cxd4", "e4 c5 Nf3 Nc6 d4", "e4 c5 Nf3 e6"]);
  });

  it("reads nested variations", () => {
    expect(sans(readPgn("1. d4 d5 2. c4 (2. Nf3 Nf6 (2... c5)) e6"))).toEqual([
      "d4 d5 c4 e6",
      "d4 d5 Nf3 c5",
      "d4 d5 Nf3 Nf6",
    ]);
  });

  it("drops headers, comments, glyphs, NAGs and results", () => {
    const pgn = `[Event "Club"]\n[White "A"]\n\n1. e4 {the best} e5! 2. Nf3 $1 Nc6?! ; a line comment\n3. Bb5 1-0`;
    expect(sans(readPgn(pgn))).toEqual(["e4 e5 Nf3 Nc6 Bb5"]);
  });

  it("reads castling written with zeros", () => {
    const read = readPgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0");
    expect(sans(read)[0].split(" ").pop()).toBe("O-O");
  });

  it("starts from a FEN header", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const read = readPgn(`[FEN "${fen}"]\n2. Nf3 Nc6`);
    expect(read).toMatchObject({ ok: true, fromFen: fen });
  });

  it("names the first illegal move", () => {
    expect(readPgn("1. e4 e5 2. Ke3")).toEqual({ ok: false, error: "2.Ke3 isn't a legal move there." });
    expect(readPgn("1. e4 Nf3")).toEqual({ ok: false, error: "1...Nf3 isn't a legal move there." });
  });

  it("refuses broken brackets, empty pastes and very long ones", () => {
    expect(readPgn("1. e4 (1. d4")).toMatchObject({ ok: false });
    expect(readPgn("1. e4 )")).toMatchObject({ ok: false });
    expect(readPgn("(1. e4)")).toMatchObject({ ok: false });
    expect(readPgn("  {just a comment} *")).toMatchObject({ ok: false });
    expect(readPgn("e4 ".repeat(MAX_PGN_CHARS))).toMatchObject({ ok: false });
  });
});

describe("pgnTrees", () => {
  it("merges the lines into one tree from their first position", () => {
    const read = readPgn("1. e4 c5 2. Nf3 d6 (2... Nc6) 3. d4");
    if (!read.ok) throw new Error(read.error);
    const trees = pgnTrees(read);
    expect(trees).toHaveLength(1);
    expect(trees[0].fen).toBe(START_FEN);
    // e4, c5, Nf3, then d6 d4 and Nc6.
    expect(countPositions(trees)).toBe(6);
  });
});
