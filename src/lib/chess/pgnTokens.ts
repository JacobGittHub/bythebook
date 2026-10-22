// The PGN tokenizer that the pasted-moves reader (src/lib/library/pgn.ts) and the game history
// import (src/lib/history/pgnGames.ts) share. It reads text in pieces, one character at a time,
// so a file of any size streams through it, and no regex ever runs over more than one short
// token. Every length is capped, and a broken piece is reported as an error token, after which
// reading carries on, so one bad game can't swallow the rest of a file. Pure, so it runs in
// tests, workers and pages alike.

/** The longest move, number or result read; longer runs of letters are an error. */
export const MAX_SYMBOL_CHARS = 32;
/** The longest header, `[Name "value"]`, read. */
export const MAX_HEADER_CHARS = 1_000;
/** The longest comment read; a longer one is an error. */
export const MAX_COMMENT_CHARS = 20_000;
/** How much of each comment is handed on, enough for the `[%clk …]` near its start. */
export const KEPT_COMMENT_CHARS = 500;

export type PgnResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/**
 * What went wrong: a header that is malformed or too long, a comment that is never closed or
 * too long, or a move-like run of characters that is too long.
 */
export type PgnError = "header" | "comment" | "symbol";

export type PgnToken =
  | { kind: "header"; name: string; value: string }
  /** A move as written, without its number or `!?` glyphs; castling with zeros reads as O-O. */
  | { kind: "move"; san: string }
  | { kind: "open" }
  | { kind: "close" }
  /** The comment's first `KEPT_COMMENT_CHARS` characters. */
  | { kind: "comment"; text: string }
  | { kind: "nag" }
  | { kind: "result"; result: PgnResult }
  | { kind: "error"; error: PgnError };

export type PgnLexer = {
  /** Reads the next piece of text; a token may span pieces. */
  push(text: string): void;
  /** Ends the text, reporting a header or comment left open. */
  end(): void;
};

const State = {
  Moves: 0,
  Header: 1,
  Comment: 2,
  /** A `;` comment or a `%` escape line, both of which run to the end of the line. */
  Line: 3,
} as const;

const HEADER_PATTERN = /^\s*([A-Za-z0-9_]{1,64})\s+"((?:[^"\\]|\\.)*)"\s*$/;
const RESULTS: readonly string[] = ["1-0", "0-1", "1/2-1/2", "*"];

/** Letters, digits and the marks a move, number, result or NAG is written with. */
function isSymbolChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 43 || // +
    code === 35 || // #
    code === 61 || // =
    code === 58 || // :
    code === 45 || // -
    code === 47 || // /
    code === 46 || // .
    code === 33 || // !
    code === 63 || // ?
    code === 36 // $
  );
}

const isLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/** The token a run of symbol characters makes, or null for a bare move number. */
function symbolToken(symbol: string): PgnToken | null {
  if (RESULTS.includes(symbol)) return { kind: "result", result: symbol as PgnResult };
  if (symbol[0] === "$") return { kind: "nag" };
  // "12.", "12...", "12.e4" and "12...Nf6" lose their numbers; "e4!?" loses its glyphs.
  const move = symbol
    .replace(/^\d+\.+/, "")
    .replace(/[!?]+$/, "")
    .replace(/^0-0-0/, "O-O-O")
    .replace(/^0-0/, "O-O");
  if (!move || /^[\d.]+$/.test(move)) return null;
  return { kind: "move", san: move };
}

/** A tokenizer that hands each token to `emit` as soon as it is complete. */
export function createPgnLexer(emit: (token: PgnToken) => void): PgnLexer {
  let state: (typeof State)[keyof typeof State] = State.Moves;
  let started = false;
  let lineStart = true;
  // The symbol, header or comment being read, and how long it really is.
  let text = "";
  let length = 0;
  let overflowed = false;
  // Within a header: inside its quotes, and just after a backslash there.
  let quoted = false;
  let escaped = false;
  // Within a comment: a "[" at the start of a line, which may be the next game's header.
  let bracketAtLineStart = false;

  const fail = (error: PgnError) => emit({ kind: "error", error });

  /** Leaves a header, comment or line for the moves, or into `next`, forgetting what was read. */
  const leave = (next: (typeof State)[keyof typeof State] = State.Moves) => {
    state = next;
    text = "";
    length = 0;
    overflowed = false;
  };

  const flushSymbol = () => {
    if (length && !overflowed) {
      const token = symbolToken(text);
      if (token) emit(token);
    }
    text = "";
    length = 0;
    overflowed = false;
  };

  const startHeader = (first = "") => {
    state = State.Header;
    text = first;
    length = first.length;
    quoted = false;
    escaped = false;
  };

  const finishHeader = () => {
    const match = HEADER_PATTERN.exec(text);
    if (match) emit({ kind: "header", name: match[1], value: match[2].replace(/\\(.)/g, "$1") });
    else fail("header");
    leave();
  };

  const startComment = () => {
    state = State.Comment;
    text = "";
    length = 0;
    overflowed = false;
    bracketAtLineStart = false;
  };

  const keepCommentChar = (char: string) => {
    length += 1;
    if (length <= KEPT_COMMENT_CHARS) text += char;
    else if (length > MAX_COMMENT_CHARS && !overflowed) {
      overflowed = true;
      fail("comment");
    }
  };

  function push(chunk: string) {
    for (let i = 0; i < chunk.length; i++) {
      const code = chunk.charCodeAt(i);
      if (!started) {
        started = true;
        if (code === 0xfeff) continue;
      }
      const atLineStart = lineStart;
      lineStart = code === 10;

      switch (state) {
        case State.Moves:
          if (isSymbolChar(code)) {
            length += 1;
            if (length <= MAX_SYMBOL_CHARS) text += chunk[i];
            else if (!overflowed) {
              overflowed = true;
              fail("symbol");
            }
            break;
          }
          flushSymbol();
          if (code === 91) startHeader(); // [
          else if (code === 123) startComment(); // {
          else if (code === 59 || (code === 37 && atLineStart)) state = State.Line; // ; or a % line
          else if (code === 40) emit({ kind: "open" }); // (
          else if (code === 41) emit({ kind: "close" }); // )
          else if (code === 42) emit({ kind: "result", result: "*" }); // *
          // Anything else, whitespace or not, only separates tokens.
          break;

        case State.Header:
          if (code === 10 || code === 13) {
            // Headers are one line each, so a line break means it was never closed.
            fail("header");
            leave();
          } else if (code === 93 && !quoted && !escaped) {
            finishHeader(); // ]
          } else {
            if (escaped) escaped = false;
            else if (code === 34) quoted = !quoted;
            else if (code === 92 && quoted) escaped = true;
            text += chunk[i];
            length += 1;
            if (length > MAX_HEADER_CHARS) {
              fail("header");
              leave(State.Line);
            }
          }
          break;

        case State.Comment:
          if (bracketAtLineStart) {
            bracketAtLineStart = false;
            // A comment never closed, followed by the next game's headers: the comment ends
            // here, so the games after it are still read.
            if (isLetter(code)) {
              fail("comment");
              startHeader(chunk[i]);
              break;
            }
            keepCommentChar("[");
          }
          if (code === 125) {
            // }
            if (!overflowed) emit({ kind: "comment", text });
            leave();
          } else if (code === 91 && atLineStart) bracketAtLineStart = true;
          else keepCommentChar(chunk[i]);
          break;

        case State.Line:
          if (code === 10) leave();
          break;
      }
    }
  }

  function end() {
    if (state === State.Moves) flushSymbol();
    else if (state === State.Header) fail("header");
    else if (state === State.Comment) fail("comment");
    leave();
  }

  return { push, end };
}

/** Every token in `text`, for input already bounded in size, such as a paste. */
export function lexPgn(text: string): PgnToken[] {
  const tokens: PgnToken[] = [];
  const lexer = createPgnLexer((token) => tokens.push(token));
  lexer.push(text);
  lexer.end();
  return tokens;
}
