// Pasted moves or a PGN, read into a book's trees (New book's second way to start, after the
// Explorer: plans/deployment.md D21). Every move is replayed with chess.js, so nothing a paste
// claims is trusted, and a variation in brackets becomes its own line. Pure, so it runs in
// tests and the browser alike.

import { Chess } from "chess.js";
import { START_FEN } from "@/lib/chess/fen";
import { lexPgn } from "@/lib/chess/pgnTokens";
import type { Move, MoveNode } from "@/types/chess";
import { addLine } from "./edit";

/** The longest paste read, which bounds the work a paste can ask for. */
export const MAX_PGN_CHARS = 100_000;

export type PgnRead =
  | {
      ok: true;
      /** The position the moves start from: the FEN header's, or the starting position. */
      fromFen: string;
      /** Every line from `fromFen` to where it ends, main line first. */
      lines: Move[][];
    }
  | { ok: false; error: string };

/** "5.Nf3" or "5...Nf6", for the position `fen` a move is played from. */
function moveName(fen: string, san: string): string {
  const [, turn, , , , fullmove] = fen.split(" ");
  return `${fullmove ?? "1"}${turn === "b" ? "..." : "."}${san}`;
}

/** Reads a paste into lines of moves, or says where it stopped making sense. */
export function readPgn(paste: string): PgnRead {
  if (paste.length > MAX_PGN_CHARS) return { ok: false, error: "That's too long to read as one book." };

  const tokens = lexPgn(paste);
  if (tokens.some((token) => token.kind === "error")) {
    return { ok: false, error: "Part of it can't be read as PGN, such as a comment or header left open." };
  }

  // Headers are read for a starting position and otherwise dropped.
  const fenHeader = tokens.find((token) => token.kind === "header" && token.name.toUpperCase() === "FEN");
  let fromFen = START_FEN;
  if (fenHeader?.kind === "header") {
    try {
      fromFen = new Chess(fenHeader.value).fen();
    } catch {
      return { ok: false, error: "The FEN header isn't a position chess.js can read." };
    }
  }

  const lines: Move[][] = [];
  // The line being read, and for each open bracket the line it branched from.
  let line: Move[] = [];
  const stack: Move[][] = [];
  const fenOf = (moves: readonly Move[]) => moves[moves.length - 1]?.fen ?? fromFen;
  const finish = (moves: Move[]) => {
    if (moves.length) lines.push(moves);
  };

  for (const token of tokens) {
    if (token.kind === "open") {
      // A variation replaces the move just played, so it starts from the position before it.
      if (!line.length) return { ok: false, error: "A variation in brackets comes before any move." };
      stack.push(line);
      line = line.slice(0, -1);
    } else if (token.kind === "close") {
      const parent = stack.pop();
      if (!parent) return { ok: false, error: "There's a closing bracket without an opening one." };
      finish(line);
      line = parent;
    } else if (token.kind === "move") {
      const game = new Chess(fenOf(line));
      try {
        const played = game.move(token.san);
        line = [...line, { san: played.san, uci: played.lan, fen: game.fen() }];
      } catch {
        return { ok: false, error: `${moveName(fenOf(line), token.san)} isn't a legal move there.` };
      }
    }
  }
  if (stack.length) return { ok: false, error: "A variation's bracket is never closed." };
  finish(line);
  if (!lines.length) return { ok: false, error: "There are no moves in it." };
  // The main line first, as it was written; variations after, in the order they closed.
  lines.unshift(lines.pop()!);
  return { ok: true, fromFen, lines };
}

/** The trees a read paste makes: every line joins the tree from its first position. */
export function pgnTrees(read: Extract<PgnRead, { ok: true }>, trees: readonly MoveNode[] = []): MoveNode[] {
  return read.lines.reduce<MoveNode[]>((built, moves) => addLine(built, moves, read.fromFen), [...trees]);
}
