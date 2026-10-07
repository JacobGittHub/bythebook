import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  averageLeafDepth,
  countPositions,
  findClashes,
  hasUnconnectedLines,
} from "@/lib/books/measures";
import { exampleBookFromFile, parseExampleFile, parseExampleIndex } from "@/lib/books/examples";
import { countMoveTreeLines } from "@/lib/chess/moveTree";
import { summarize } from "./summary";

const EXAMPLES = path.join(process.cwd(), "public/books/examples");
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(EXAMPLES, file), "utf8"));

describe("summarize", () => {
  const index = parseExampleIndex(read("index.json"));

  it("agrees with the measures on every example book", () => {
    expect(index?.books.length).toBeGreaterThan(0);
    for (const entry of index!.books) {
      const book = exampleBookFromFile(parseExampleFile(read(entry.file))!);
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
