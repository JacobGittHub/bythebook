// A small, fast move player: a UCI move on a FEN, giving the next FEN exactly as chess.js would
// write it, without generating legal moves (plans/game-history.md D27). It is for moves already
// known to be legal, such as a stored game's or a book's, when many positions are needed at
// once: rejoining a book by transposition, and drawing the game history's tree. It checks the
// move's shape and that the side to move owns the piece, but not whether the move is legal.

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

/**
 * The FEN after playing `uci` from `fen`, or null when the FEN is malformed or the move can't be
 * a move there: no piece of the side to move on its square, a capture of its own piece, or a
 * promotion that doesn't fit. Legality (checks and pins) isn't tested; that is chess.js's job.
 */
export function applyUci(fen: string, uci: string): string | null {
  const move = UCI.exec(uci);
  const position = move && parseFen(fen);
  if (!move || !position) return null;
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
    enPassant: null,
    halfmoves: kind === "p" || captured ? 0 : position.halfmoves + 1,
    fullmoves: white ? position.fullmoves : position.fullmoves + 1,
  };
  return writeFen(next, enPassant);
}
