// Example books: ready-made books shown by the book views so every visitor, guests included,
// has something to look at before they build their own. They are static files under
// `public/books/examples/`, written by `npm run books:examples` (`scripts/buildExampleBooks.ts`)
// and served by the CDN, so showing one costs no function call. Each file says how it was
// made and, when its source needs it, whom to credit and under which licence.

import { Chess } from "chess.js";
import { z } from "zod";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import type { Move, MoveNode, OpeningBook } from "@/types/chess";

/** Where the example books are served from. */
export const EXAMPLE_BOOKS_PATH = "/books/examples";

/** Example book ids carry this prefix, so they never collide with an account's book ids. */
export const EXAMPLE_ID_PREFIX = "example:";

/**
 * How a book was made: from the page titles of Wikibooks' Chess Opening Theory, from the
 * opening catalog's named lines (public domain), or grown from master statistics
 * (`grow.ts`), optionally starting from the catalog's lines.
 */
export const EXAMPLE_METHODS = ["wikibooks", "catalog", "masters", "catalog+masters"] as const;
export type ExampleMethod = (typeof EXAMPLE_METHODS)[number];

export const attributionSchema = z.object({
  /** The work's title, as its source names it. */
  title: z.string(),
  url: z.string().url(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().url(),
  /** The day it was downloaded, YYYY-MM-DD. */
  retrieved: z.string(),
  /** What was changed, which CC BY-SA asks to be stated. */
  changes: z.string(),
});
export type Attribution = z.infer<typeof attributionSchema>;

const exampleFileSchema = z.object({
  version: z.literal(1),
  id: z.string().startsWith(EXAMPLE_ID_PREFIX),
  name: z.string().max(60),
  color: z.enum(["white", "black"]),
  description: z.string().max(400),
  method: z.enum(EXAMPLE_METHODS),
  /** Who to credit, or null when the source needs no credit. */
  attribution: attributionSchema.nullable(),
  /** How the book was built, in words, so a rebuild can be checked against it. */
  rules: z.string(),
  /** Every line from the starting position to a leaf, as SAN moves separated by spaces. */
  lines: z.array(z.string()).min(1),
});
export type ExampleBookFile = z.infer<typeof exampleFileSchema>;

const exampleIndexSchema = z.object({
  version: z.literal(1),
  books: z.array(
    z.object({
      id: z.string().startsWith(EXAMPLE_ID_PREFIX),
      name: z.string(),
      color: z.enum(["white", "black"]),
      method: z.enum(EXAMPLE_METHODS),
      positions: z.number().int().nonnegative(),
      /** The file's name in `EXAMPLE_BOOKS_PATH`. */
      file: z.string().regex(/^[\w-]+\.json$/),
    }),
  ),
});
export type ExampleBookIndex = z.infer<typeof exampleIndexSchema>;
export type ExampleBookEntry = ExampleBookIndex["books"][number];

export function parseExampleIndex(value: unknown): ExampleBookIndex | null {
  const parsed = exampleIndexSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseExampleFile(value: unknown): ExampleBookFile | null {
  const parsed = exampleFileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** An example book, ready for anything that shows an `OpeningBook`. */
export type ExampleBook = OpeningBook & {
  method: ExampleMethod;
  attribution: Attribution | null;
  rules: string;
};

/**
 * Replays SAN lines from the starting position into lines of moves. A line stops at its first
 * move that isn't legal, so a damaged file can only shorten a book.
 */
export function replaySanLines(lines: readonly string[]): { lines: Move[][]; rejected: number } {
  let rejected = 0;
  const replayed = lines.map((line) => {
    const game = new Chess(START_FEN);
    const moves: Move[] = [];
    for (const san of line.split(/\s+/).filter(Boolean)) {
      try {
        const move = game.move(san);
        moves.push({ san: move.san, uci: move.lan, fen: game.fen() });
      } catch {
        rejected++;
        break;
      }
    }
    return moves;
  });
  return { lines: replayed.filter((moves) => moves.length > 0), rejected };
}

export function exampleBookFromFile(file: ExampleBookFile): ExampleBook {
  const tree: MoveNode = buildMoveTreeFromLines(replaySanLines(file.lines).lines, START_FEN);
  return {
    id: file.id,
    name: file.name,
    color: file.color,
    description: file.description,
    rootFen: START_FEN,
    moveNode: tree,
    method: file.method,
    attribution: file.attribution,
    rules: file.rules,
  };
}

/** The SAN lines of a tree, one per leaf, the reverse of `exampleBookFromFile`. */
export function sanLinesOf(tree: MoveNode): string[] {
  const lines: string[] = [];
  const walk = (node: MoveNode, sans: string[]) => {
    if (!node.children.length) {
      if (sans.length) lines.push(sans.join(" "));
      return;
    }
    for (const child of node.children) walk(child, [...sans, child.san ?? ""]);
  };
  walk(tree, []);
  return lines;
}

/** A short credit line for a book's source. */
export function creditLine(attribution: Attribution): string {
  return `${attribution.title}, by ${attribution.author}, ${attribution.license}`;
}
