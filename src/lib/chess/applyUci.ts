// A small, fast move player: a UCI move on a FEN, giving the next FEN exactly as chess.js would
// write it, without generating legal moves (plans/game-history.md D27). It is for moves already
// known to be legal, such as a stored game's or a book's, when many positions are needed at
// once: rejoining a book by transposition, and drawing the game history's tree. It checks the
// move's shape and that the side to move owns the piece, but not whether the move is legal.
// `uciToSan` names the move as chess.js would, for the same trees.

const UCI = /^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/;
const CASTLING = /^(-|K?Q?k?q?)$/;

type Position = {
  /** a1 is 0, h1 7, a8 56: index rank * 8 + file. "" for an empty square. */
  board: string[];
  white: boolean;
  castling: string;
  enPassant: number | null;
  halfmoves: number;
  fullmoves: number;
};

const isWhite = (piece: string) => piece !== "" && piece === piece.toUpperCase();
const fileOf = (square: number) => square & 7;
const rankOf = (square: number) => square >> 3;
const squareName = (square: number) => "abcdefgh"[fileOf(square)] + (rankOf(square) + 1);
const squareAt = (name: string) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);

function parseFen(fen: string): Position | null {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) return null;
  const [placement, turn, castling, enPassant, halfmoves, fullmoves] = fields;
  const rows = placement.split("/");
  if (rows.length !== 8 || (turn !== "w" && turn !== "b") || !CASTLING.test(castling)) return null;
  if (enPassant !== "-" && !/^[a-h][36]$/.test(enPassant)) return null;
  if (!/^\d+$/.test(halfmoves) || !/^\d+$/.test(fullmoves)) return null;

  const board: string[] = new Array(64).fill("");
  for (let row = 0; row < 8; row++) {
    let file = 0;
    for (const char of rows[row]) {
      if (char >= "1" && char <= "8") file += Number(char);
      else if ("pnbrqkPNBRQK".includes(char) && file < 8) board[(7 - row) * 8 + file++] = char;
      else return null;
    }
    if (file !== 8) return null;
  }
  return {
    board,
    white: turn === "w",
    castling,
    enPassant: enPassant === "-" ? null : squareAt(enPassant),
    halfmoves: Number(halfmoves),
    fullmoves: Number(fullmoves),
  };
}

function writeFen(position: Position, enPassant: string): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = position.board[rank * 8 + file];
      if (!piece) empty += 1;
      else {
        if (empty) row += empty;
        row += piece;
        empty = 0;
      }
    }
    rows.push(empty ? row + empty : row);
  }
  const castling = position.castling || "-";
  return `${rows.join("/")} ${position.white ? "w" : "b"} ${castling} ${enPassant} ${position.halfmoves} ${position.fullmoves}`;
}

const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_LINES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_LINES = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Whether a piece of the given side attacks `square`. */
function attacked(board: readonly string[], square: number, byWhite: boolean): boolean {
  const [file, rank] = [fileOf(square), rankOf(square)];
  const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? board[r * 8 + f] : "");
  const own = (piece: string) => (byWhite ? piece.toUpperCase() : piece.toLowerCase());

  const pawnRank = byWhite ? rank - 1 : rank + 1;
  if (at(file - 1, pawnRank) === own("p") || at(file + 1, pawnRank) === own("p")) return true;
  if (KNIGHT_STEPS.some(([df, dr]) => at(file + df, rank + dr) === own("n"))) return true;
  if (KING_STEPS.some(([df, dr]) => at(file + df, rank + dr) === own("k"))) return true;
  const slides = (lines: number[][], pieces: string[]) =>
    lines.some(([df, dr]) => {
      for (let f = file + df, r = rank + dr; f >= 0 && f < 8 && r >= 0 && r < 8; f += df, r += dr) {
        const piece = board[r * 8 + f];
        if (piece) return pieces.includes(piece);
      }
      return false;
    });
  return slides(ROOK_LINES, [own("r"), own("q")]) || slides(BISHOP_LINES, [own("b"), own("q")]);
}

/**
 * The en passant square to write after a pawn's double step to `to`, as chess.js writes it:
 * only when an enemy pawn beside it could take en passant without leaving its king in check.
 */
function enPassantAfter(board: readonly string[], to: number, passed: number, moverWhite: boolean): string {
  const enemyPawn = moverWhite ? "p" : "P";
  const enemyKing = board.indexOf(moverWhite ? "k" : "K");
  for (const side of [-1, 1]) {
    const file = fileOf(to) + side;
    if (file < 0 || file > 7) continue;
    const from = rankOf(to) * 8 + file;
    if (board[from] !== enemyPawn) continue;
    const after = [...board];
    after[passed] = enemyPawn;
    after[from] = "";
    after[to] = "";
    if (enemyKing < 0 || !attacked(after, enemyKing, moverWhite)) return squareName(passed);
  }
  return "-";
}

type Played = {
  next: Position;
  /** The en passant field to write: "-", or a square only when a capture there is legal. */
  enPassant: string;
  kind: string;
  from: number;
  to: number;
  captured: boolean;
  promotion: string | undefined;
};

/** Plays `uci` on `position`, changing its board, or returns null when it can't be a move there. */
function play(position: Position, uci: string): Played | null {
  const move = UCI.exec(uci);
  if (!move) return null;
  const { board, white } = position;
  const from = squareAt(move[1] + move[2]);
  const to = squareAt(move[3] + move[4]);
  const promotion = move[5];
  const piece = board[from];
  const target = board[to];
  if (from === to || !piece || isWhite(piece) !== white || (target && isWhite(target) === white)) return null;

  const kind = piece.toLowerCase();
  const [fileStep, rankStep] = [fileOf(to) - fileOf(from), rankOf(to) - rankOf(from)];
  const lastRank = white ? 7 : 0;
  if (kind === "p" ? (rankOf(to) === lastRank) !== Boolean(promotion) : Boolean(promotion)) return null;

  let captured = Boolean(target);
  if (kind === "p" && fileStep !== 0 && !target) {
    // En passant: the pawn taken stands beside the moving one, behind the square it lands on.
    if (to !== position.enPassant) return null;
    board[to - (white ? 8 : -8)] = "";
    captured = true;
  }
  if (kind === "k" && Math.abs(fileStep) === 2 && rankStep === 0) {
    const rank = rankOf(from) * 8;
    const [rookFrom, rookTo] = fileStep > 0 ? [rank + 7, rank + 5] : [rank, rank + 3];
    if (board[rookFrom] !== (white ? "R" : "r")) return null;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = "";
  }
  board[to] = promotion ? (white ? promotion.toUpperCase() : promotion) : piece;
  board[from] = "";

  // A king's move loses both its rights; a move from or onto a rook's corner loses that one.
  let castling = position.castling === "-" ? "" : position.castling;
  if (kind === "k") castling = castling.replace(white ? /[KQ]/g : /[kq]/g, "");
  for (const [corner, right] of [[0, "Q"], [7, "K"], [56, "q"], [63, "k"]] as const) {
    if (from === corner || to === corner) castling = castling.replace(right, "");
  }

  const doubleStep = kind === "p" && Math.abs(rankStep) === 2;
  const enPassant = doubleStep ? enPassantAfter(board, to, (from + to) / 2, white) : "-";
  const next: Position = {
    board,
    white: !white,
    castling,
    enPassant: enPassant === "-" ? null : squareAt(enPassant),
    halfmoves: kind === "p" || captured ? 0 : position.halfmoves + 1,
    fullmoves: white ? position.fullmoves : position.fullmoves + 1,
  };
  return { next, enPassant, kind, from, to, captured, promotion };
}

/**
 * The FEN after playing `uci` from `fen`, or null when the FEN is malformed or the move can't be
 * a move there: no piece of the side to move on its square, a capture of its own piece, or a
 * promotion that doesn't fit. Legality (checks and pins) isn't tested; that is chess.js's job.
 */
export function applyUci(fen: string, uci: string): string | null {
  const position = parseFen(fen);
  const played = position && play(position, uci);
  return played ? writeFen(played.next, played.enPassant) : null;
}

/** The squares a piece of `kind` on `from` attacks, ignoring pins: for a pawn, its captures only. */
function reach(board: readonly string[], from: number, kind: string, white: boolean): number[] {
  const [file, rank] = [fileOf(from), rankOf(from)];
  const squares: number[] = [];
  /** Adds the square if it is on the board, and says whether a slide may carry on past it. */
  const add = (f: number, r: number) => {
    if (f < 0 || f > 7 || r < 0 || r > 7) return false;
    squares.push(r * 8 + f);
    return !board[r * 8 + f];
  };
  if (kind === "p") {
    add(file - 1, rank + (white ? 1 : -1));
    add(file + 1, rank + (white ? 1 : -1));
  } else if (kind === "n" || kind === "k") {
    for (const [df, dr] of kind === "n" ? KNIGHT_STEPS : KING_STEPS) add(file + df, rank + dr);
  } else {
    const lines = kind === "r" ? ROOK_LINES : kind === "b" ? BISHOP_LINES : [...ROOK_LINES, ...BISHOP_LINES];
    for (const [df, dr] of lines) {
      for (let f = file + df, r = rank + dr; add(f, r); f += df, r += dr);
    }
  }
  return squares;
}

/** Whether moving `from` to `to`, taking whatever stands on `taken`, leaves the mover's king safe. */
function safe(board: readonly string[], from: number, to: number, white: boolean, taken = to): boolean {
  const after = [...board];
  after[taken] = "";
  after[to] = after[from];
  after[from] = "";
  const king = after.indexOf(white ? "K" : "k");
  return king >= 0 && !attacked(after, king, !white);
}

/** Whether the side to move has a legal move. Castling is left out, since it is only asked in check. */
function hasMove(position: Position): boolean {
  const { board, white } = position;
  const own = (square: number) => board[square] !== "" && isWhite(board[square]) === white;
  for (let from = 0; from < 64; from++) {
    if (!own(from)) continue;
    const kind = board[from].toLowerCase();
    const targets = reach(board, from, kind, white).filter((square) => !own(square));
    if (kind !== "p") {
      if (targets.some((to) => safe(board, from, to, white))) return true;
      continue;
    }
    for (const to of targets) {
      if (board[to] && safe(board, from, to, white)) return true;
      if (to === position.enPassant && safe(board, from, to, white, to - (white ? 8 : -8))) return true;
    }
    const step = white ? 8 : -8;
    if (!board[from + step]) {
      if (safe(board, from, from + step, white)) return true;
      const home = rankOf(from) === (white ? 1 : 6);
      if (home && !board[from + 2 * step] && safe(board, from, from + 2 * step, white)) return true;
    }
  }
  return false;
}

/**
 * The move `uci` from `fen` in SAN, exactly as chess.js writes it ("Nbd7", "exd8=Q+", "O-O#"), or
 * null where `applyUci` would refuse it. Like `applyUci` it is for moves known to be legal; it
 * runs many times faster than chess.js, so the game history's tree can name thousands of moves.
 */
export function uciToSan(fen: string, uci: string): string | null {
  const position = parseFen(fen);
  if (!position) return null;
  const before = [...position.board];
  const white = position.white;
  const played = play(position, uci);
  if (!played) return null;
  const { next, kind, from, to, captured, promotion } = played;

  let san: string;
  if (kind === "k" && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    san = fileOf(to) > fileOf(from) ? "O-O" : "O-O-O";
  } else if (kind === "p") {
    const taking = captured ? `${"abcdefgh"[fileOf(from)]}x` : "";
    san = `${taking}${squareName(to)}${promotion ? `=${promotion.toUpperCase()}` : ""}`;
  } else {
    // Another piece of the same kind that could also go there is told apart by file, then rank.
    const rivals: number[] = [];
    for (let square = 0; square < 64; square++) {
      if (square === from || before[square] !== before[from]) continue;
      if (reach(before, square, kind, white).includes(to) && safe(before, square, to, white)) rivals.push(square);
    }
    let which = "";
    if (rivals.length && rivals.every((square) => fileOf(square) !== fileOf(from))) which = "abcdefgh"[fileOf(from)];
    else if (rivals.length && rivals.every((square) => rankOf(square) !== rankOf(from))) which = String(rankOf(from) + 1);
    else if (rivals.length) which = squareName(from);
    san = `${kind.toUpperCase()}${which}${captured ? "x" : ""}${squareName(to)}`;
  }

  const king = next.board.indexOf(next.white ? "K" : "k");
  if (king >= 0 && attacked(next.board, king, white)) san += hasMove(next) ? "+" : "#";
  return san;
}
