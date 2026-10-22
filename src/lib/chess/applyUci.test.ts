import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess, type Square } from "chess.js";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "@/lib/regions/testShapes";
import { readGames } from "@/lib/history/pgnGames";
import { applyUci } from "./applyUci";
import { START_FEN } from "./fen";

/** A small seeded generator, so a failing game can be played again. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Plays a game with chess.js and applyUci side by side, noting where the FENs differ. `play`
 * makes the next move on `chess` and returns it in UCI, or returns null to stop.
 */
function compare(label: string, play: (chess: Chess, ply: number) => string | null, violations: string[]) {
  const chess = new Chess();
  let fen = START_FEN;
  for (let ply = 0; ; ply++) {
    const uci = play(chess, ply);
    if (!uci) return;
    const played = applyUci(fen, uci);
    if (played !== chess.fen()) {
      violations.push(`${label}, ply ${ply + 1} ${uci}: ${played} instead of ${chess.fen()}`);
      return;
    }
    fen = played;
  }
}

describe("applyUci against chess.js", () => {
  it("matches every position of the fixture games", () => {
    const violations: string[] = [];
    for (const name of ["chesscom.pgn", "lichess.pgn"]) {
      const text = readFileSync(join(__dirname, "../history/fixtures", name), "utf8");
      for (const [index, game] of readGames(text, { plies: 10_000 }).games.entries()) {
        if (game.headers.has("FEN")) continue;
        compare(`${name} game ${index + 1}`, (chess, ply) => {
          const san = game.sans[ply];
          return san === undefined ? null : chess.move(san).lan;
        }, violations);
      }
    }
    expectNoViolations(violations);
  });

  it("matches random games, with their castling, en passant and promotions", () => {
    const violations: string[] = [];
    const seen = { castle: 0, enPassant: 0, promotion: 0 };
    for (let seed = 1; seed <= 20; seed++) {
      const next = random(seed);
      compare(`seed ${seed}`, (chess, ply) => {
        const moves = chess.moves();
        if (!moves.length || ply >= 160) return null;
        // Castling and pawn moves are favoured, so games castle, take en passant and promote often.
        const castles = moves.filter((san) => san.startsWith("O-O"));
        const pawns = moves.filter((san) => san[0] >= "a" && san[0] <= "h");
        // A pawn's capture onto an empty square ("exd6") is en passant.
        const enPassants = pawns.filter((san) => san[1] === "x" && !chess.get(san.slice(2, 4) as Square));
        const pool = [enPassants, castles, pawns].find((list) => list.length && next() < 0.5) ?? moves;
        const move = chess.move(pool[Math.floor(next() * pool.length)]);
        if (move.isKingsideCastle() || move.isQueensideCastle()) seen.castle += 1;
        if (move.isEnPassant()) seen.enPassant += 1;
        if (move.isPromotion()) seen.promotion += 1;
        return move.lan;
      }, violations);
    }
    expectNoViolations(violations);
    expect(seen.castle).toBeGreaterThan(5);
    expect(seen.enPassant).toBeGreaterThan(5);
    expect(seen.promotion).toBeGreaterThan(5);
  });
});

describe("applyUci", () => {
  it("writes en passant only where a pawn could take, and not when pinned", () => {
    expect(applyUci(START_FEN, "e2e4")).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(applyUci("4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1", "e2e4")).toBe("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1");
    // The black pawn on d4 is pinned to its king on a4 by the rook on h4 once e4 leaves.
    expect(applyUci("8/8/8/8/k2p3R/8/4P3/4K3 w - - 0 1", "e2e4")).toBe("8/8/8/8/k2pP2R/8/8/4K3 b - - 0 1");
  });

  it("refuses moves that can't be made, and malformed positions", () => {
    expect(applyUci(START_FEN, "e7e5")).toBeNull();
    expect(applyUci(START_FEN, "e1e2")).toBeNull();
    expect(applyUci(START_FEN, "e2e5x")).toBeNull();
    expect(applyUci(START_FEN, "e2e2")).toBeNull();
    expect(applyUci(START_FEN, "e2e3q")).toBeNull();
    expect(applyUci("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8")).toBeNull();
    expect(applyUci("4k3/8/8/8/8/8/8/4K3 w K - 0 1", "e1g1")).toBeNull();
    expect(applyUci("not a fen", "e2e4")).toBeNull();
    expect(applyUci("rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4")).toBeNull();
  });
});
