import { describe, expect, it } from "vitest";
import { countPositions } from "@/lib/books/measures";
import { EXAMPLE_ID_PREFIX, exampleBookFromFile, parseExampleFile, replaySanLines, sanLinesOf } from "./examples";
import { linesFromTitles, titleMoves, wikibooksUrl } from "./wikibooks";

const file = {
  version: 1,
  id: `${EXAMPLE_ID_PREFIX}test`,
  name: "Test book",
  color: "white",
  description: "Two lines.",
  method: "catalog",
  attribution: null,
  rules: "Written by hand for a test.",
  lines: ["d4 d5 c4 e6", "d4 d5 c4 c6"],
};

describe("example book files", () => {
  it("read back into a book whose lines are the file's lines", () => {
    const parsed = parseExampleFile(file);
    expect(parsed).not.toBeNull();
    const book = exampleBookFromFile(parsed!);
    expect(countPositions([book.moveNode])).toBe(5);
    expect(sanLinesOf(book.moveNode)).toEqual(file.lines);
    expect(book.moveNode.children[0].uci).toBe("d2d4");
  });

  it("reject a file without the example prefix or without lines", () => {
    expect(parseExampleFile({ ...file, id: "test" })).toBeNull();
    expect(parseExampleFile({ ...file, lines: [] })).toBeNull();
    expect(parseExampleFile({ ...file, attribution: { title: "x" } })).toBeNull();
  });

  it("stop a line at its first illegal move", () => {
    const { lines, rejected } = replaySanLines(["e4 e5 Ke3 Nc6", "Qh5"]);
    expect(lines.map((line) => line.map((move) => move.san))).toEqual([["e4", "e5"]]);
    expect(rejected).toBe(2);
  });
});

describe("Wikibooks titles", () => {
  it("name the moves of their page", () => {
    expect(titleMoves("Chess Opening Theory/1. d4/1...d5/2. c4")).toEqual(["d4", "d5", "c4"]);
    expect(titleMoves("Chess Opening Theory/1. d4/2. c4")).toBeNull();
    expect(titleMoves("Chess Opening Theory/1. d4/1...d5/Theory")).toBeNull();
    expect(titleMoves("Something else/1. e4")).toBeNull();
    expect(wikibooksUrl("Chess Opening Theory/1. d4")).toBe(
      "https://en.wikibooks.org/wiki/Chess_Opening_Theory/1._d4",
    );
  });

  it("make one line per leaf and skip titles that don't replay", () => {
    const { lines, skipped } = linesFromTitles([
      "Chess Opening Theory/1. d4",
      "Chess Opening Theory/1. d4/1...d5",
      "Chess Opening Theory/1. d4/1...d5/2. c4",
      "Chess Opening Theory/1. d4/1...d5/2. Nf3",
      "Chess Opening Theory/1. d4/1...d5/2. Ke3",
      "Chess Opening Theory/1. d4/1...Nf6",
      "Chess Opening Theory/1. d4/1...d5/notes",
    ]);
    expect(lines).toEqual(["d4 d5 c4", "d4 d5 Nf3", "d4 Nf6"]);
    expect(skipped).toEqual([
      "Chess Opening Theory/1. d4/1...d5/2. Ke3",
      "Chess Opening Theory/1. d4/1...d5/notes",
    ]);
  });
});
