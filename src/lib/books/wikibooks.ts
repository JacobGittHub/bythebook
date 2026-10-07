// Wikibooks' Chess Opening Theory has one page per move sequence, titled by its moves:
// "Chess Opening Theory/1. d4/1...d5/2. c4". The titles under a section are therefore its
// move tree, which `npm run books:examples` turns into an example book. The pages' text isn't
// used. The book is credited to Wikibooks' contributors under CC BY-SA (`examples.ts`).

import { Chess } from "chess.js";
import { START_FEN } from "@/lib/chess/fen";

export const WIKIBOOKS_ROOT = "Chess Opening Theory";

/** The page's address on Wikibooks. */
export function wikibooksUrl(title: string): string {
  return `https://en.wikibooks.org/wiki/${encodeURI(title.replace(/ /g, "_"))}`;
}

/** The SAN moves a page title names, or null when the title isn't a move sequence. */
export function titleMoves(title: string): string[] | null {
  const parts = title.split("/");
  if (parts[0] !== WIKIBOOKS_ROOT || parts.length < 2) return null;
  const moves: string[] = [];
  for (const [i, part] of parts.slice(1).entries()) {
    // "1. d4" for White's first move, "1...d5" for Black's reply.
    const match = /^(\d+)\.(\.\.)?\s*(\S+)$/.exec(part.trim());
    if (!match) return null;
    const [, number, dots, san] = match;
    const ply = (Number(number) - 1) * 2 + (dots ? 1 : 0);
    if (ply !== i) return null;
    moves.push(san);
  }
  return moves;
}

/**
 * The tree the titles describe, as one SAN line per leaf, in title order. Titles that don't
 * parse, or name an illegal move, are skipped and returned, so the credit line can say so.
 */
export function linesFromTitles(titles: readonly string[]): { lines: string[]; skipped: string[] } {
  type Node = { children: Map<string, Node> };
  const root: Node = { children: new Map() };
  const skipped: string[] = [];

  for (const title of titles) {
    const sans = titleMoves(title);
    if (!sans) {
      skipped.push(title);
      continue;
    }
    const game = new Chess(START_FEN);
    const played: string[] = [];
    try {
      for (const san of sans) played.push(game.move(san).san);
    } catch {
      skipped.push(title);
      continue;
    }
    // Add the line only once every move checks out.
    let parent = root;
    for (const san of played) {
      if (!parent.children.has(san)) parent.children.set(san, { children: new Map() });
      parent = parent.children.get(san)!;
    }
  }

  const lines: string[] = [];
  const walk = (node: Node, sans: string[]) => {
    if (!node.children.size) {
      if (sans.length) lines.push(sans.join(" "));
      return;
    }
    for (const [san, child] of node.children) walk(child, [...sans, san]);
  };
  walk(root, []);
  return { lines, skipped };
}
