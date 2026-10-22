import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess, type Move, type Square } from "chess.js";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "@/lib/regions/testShapes";
import { readGames } from "@/lib/history/pgnGames";
import { applyUci, uciToSan } from "./applyUci";
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
 * Plays a game with chess.js and the move player side by side, noting where the FENs or the SANs
 * differ. `play` makes the next move on `chess` and returns it, or returns null to stop.
 */
function compare(label: string, play: (chess: Chess, ply: number) => Move | null, violations: string[]) {
  const chess = new Chess();
  let fen = START_FEN;
  for (let ply = 0; ; ply++) {
    const move = play(chess, ply);
    if (!move) return;
    const san = uciToSan(fen, move.lan);
    if (san !== move.san) violations.push(`${label}, ply ${ply + 1} ${move.lan}: ${san} instead of ${move.san}`);
    const played = applyUci(fen, move.lan);
    if (played !== chess.fen()) {
      violations.push(`${label}, ply ${ply + 1} ${move.lan}: ${played} instead of ${chess.fen()}`);
      return;
    }
    fen = played;
  }
}

describe("applyUci and uciToSan against chess.js", () => {
  it("matches every position of the fixture games", () => {
    const violations: string[] = [];
    for (const name of ["chesscom.pgn", "lichess.pgn"]) {
      const text = readFileSync(join(__dirname, "../history/fixtures", name), "utf8");
      for (const [index, game] of readGames(text, { plies: 10_000 }).games.entries()) {
        if (game.headers.has("FEN")) continue;
        compare(`${name} game ${index + 1}`, (chess, ply) => {
          const san = game.sans[ply];
          return san === undefined ? null : chess.move(san);
        }, violations);
      }
    }
    expectNoViolations(violations);
  });

  it("matches random games, with their castling, en passant, promotions, rivals and mates", () => {
    const violations: string[] = [];
    const seen = { castle: 0, enPassant: 0, promotion: 0, told: 0, mate: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const next = random(seed);
      compare(`seed ${seed}`, (chess, ply) => {
        const moves = chess.moves();
        if (!moves.length || ply >= 160) return null;
        // Castling and pawn moves are favoured, so games castle, take en passant and promote often.
        const castles = moves.filter((san) => san.startsWith("O-O"));
        const pawns = moves.filter((san) => san[0] >= "a" && san[0] <= "h");
        // A pawn's capture onto an empty square ("exd6") is en passant.
        const enPassants = pawns.filter((san) => san[1] === "x" && !chess.get(san.slice(2, 4) as Square));
        // A mate is always taken, and checks often, so games end in mate.
        const mates = moves.filter((san) => san.endsWith("#"));
        const checks = moves.filter((san) => san.endsWith("+"));
        const pool = mates.length ? mates : ([checks, enPassants, castles, pawns].find((list) => list.length && next() < 0.5) ?? moves);
        const move = chess.move(pool[Math.floor(next() * pool.length)]);
        if (move.isKingsideCastle() || move.isQueensideCastle()) seen.castle += 1;
        if (move.isEnPassant()) seen.enPassant += 1;
        if (move.isPromotion()) seen.promotion += 1;
        // A piece told apart from another of its kind: "Nbd7", "R1e2", "Qh4e1".
        if (/^[NBRQ]/.test(move.san) && move.san.replace(/[x+#]/g, "").length > 3) seen.told += 1;
        if (move.san.endsWith("#")) seen.mate += 1;
        return move;
      }, violations);
    }
    expectNoViolations(violations);
    expect(seen.castle).toBeGreaterThan(5);
    expect(seen.enPassant).toBeGreaterThan(5);
    expect(seen.promotion).toBeGreaterThan(5);
    expect(seen.told).toBeGreaterThan(5);
    expect(seen.mate).toBeGreaterThan(5);
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

describe("uciToSan", () => {
  it("names castling, promotions, rivals told apart and pinned rivals left out", () => {
    expect(uciToSan("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1")).toBe("O-O");
    expect(uciToSan("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", "e8c8")).toBe("O-O-O");
    expect(uciToSan("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7b8q")).toBe("axb8=Q+");
    expect(uciToSan("4k3/8/8/8/8/8/8/R4RK1 w - - 0 1", "a1d1")).toBe("Rad1");
    expect(uciToSan("4k3/8/8/8/R7/8/8/R3K3 w - - 0 1", "a1a2")).toBe("R1a2");
    // The knight on e2 is pinned to its king by the bishop on b5, so the one on c3 needs no file.
    expect(uciToSan("4k3/8/8/1b6/8/2N5/4N3/5K2 w - - 0 1", "c3d5")).toBe("Nd5");
    expect(uciToSan("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8")).toBe("Ra8#");
  });

  it("refuses what applyUci refuses", () => {
    expect(uciToSan(START_FEN, "e7e5")).toBeNull();
    expect(uciToSan("not a fen", "e2e4")).toBeNull();
  });
});
