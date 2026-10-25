import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  averageLeafDepth,
  countPositions,
  findClashes,
  hasUnconnectedLines,
  measuredDifficulty,
} from "@/lib/books/measures";
import { exampleBookFromFile, parseExampleFile, parseExampleIndex } from "@/lib/books/examples";
import { countMoveTreeLines } from "@/lib/chess/moveTree";
import { summarize } from "./summary";

const EXAMPLES = path.join(process.cwd(), "public/books/examples");
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(EXAMPLES, file), "utf8"));

// The example books, read once while the tests are collected, since building them is slow.
const index = parseExampleIndex(read("index.json"));
const examples = (index?.books ?? []).map((entry) => ({ entry, book: exampleBookFromFile(parseExampleFile(read(entry.file))!) }));

describe("summarize", () => {
  it("agrees with the measures on every example book", () => {
    expect(examples.length).toBeGreaterThan(0);
    for (const { entry, book } of examples) {
      const trees = book.trees;
      const summary = summarize(trees, book.color);
      expect(book.summary, entry.id).toEqual(summary);
      expect(summary, entry.id).toMatchObject({
        v: 1,
        positions: countPositions(trees),
        lines: countMoveTreeLines(trees[0]),
        trees: 1,
        unconnected: hasUnconnectedLines(trees),
        averageDepth: averageLeafDepth(trees),
        clashes: findClashes(trees, book.color).length,
      });
      expect(summary.positions, entry.id).toBe(entry.positions);
      expect(summary.maxDepth, entry.id).toBeGreaterThanOrEqual(Math.ceil(summary.averageDepth ?? 0));
      expect(summary.miniature.blocks.length, entry.id).toBeGreaterThan(0);
    }
  });
});

describe("measuredDifficulty", () => {
  // plans/bookstore.md D17 lists these from the books as built then; the Caro-Kann and the Queen's
  // Gambit masters book have since come to 0.1 less.
  it("gives the example books the difficulties plans/bookstore.md D17 lists", () => {
    const difficulties = Object.fromEntries(
      examples.map(({ entry, book }) => [entry.id.replace("example:", ""), measuredDifficulty(book.trees, book.color)]),
    );
    expect(difficulties).toMatchObject({
      "english-opening": 0.9,
      "kings-gambit": 1,
      "french-defense": 2.3,
      "queens-gambit": 2.9,
      "sicilian-defense": 3.1,
      "queens-gambit-masters": 3.3,
      "caro-kann-defense": 3.4,
      "ruy-lopez": 3.5,
      "italian-game": 4.3,
      "queens-gambit-catalog": 5,
    });
  });
});
