import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPgnLexer, KEPT_COMMENT_CHARS, lexPgn, MAX_COMMENT_CHARS, MAX_HEADER_CHARS, type PgnToken } from "./pgnTokens";

const fixture = readFileSync(join(__dirname, "../history/fixtures/lichess.pgn"), "utf8");
const kinds = (tokens: PgnToken[]) => tokens.map((token) => token.kind);
const moves = (tokens: PgnToken[]) => tokens.flatMap((token) => (token.kind === "move" ? [token.san] : []));
const errors = (tokens: PgnToken[]) => tokens.flatMap((token) => (token.kind === "error" ? [token.error] : []));

describe("lexPgn", () => {
  it("reads headers, unescaping their values", () => {
    expect(lexPgn('[Event "The \\"Big\\" one"] [Site "a\\\\b"]')).toEqual([
      { kind: "header", name: "Event", value: 'The "Big" one' },
      { kind: "header", name: "Site", value: "a\\b" },
    ]);
  });

  it("drops move numbers and glyphs, and reads castling with zeros", () => {
    expect(moves(lexPgn("1. e4 e5 2.Nf3 2...Nc6!? 3. Bb5?? a6 4. 0-0 Nf6 5. d3 b5 6. Bb3 0-0-0+"))).toEqual(
      ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "O-O", "Nf6", "d3", "b5", "Bb3", "O-O-O+"],
    );
  });

  it("reads brackets, NAGs, results and comments", () => {
    const tokens = lexPgn("1. e4 $1 (1. d4) {good} 1-0 *");
    expect(kinds(tokens)).toEqual(["move", "nag", "open", "move", "close", "comment", "result", "result"]);
    expect(tokens[5]).toEqual({ kind: "comment", text: "good" });
  });

  it("skips line comments, escape lines and a byte order mark", () => {
    expect(moves(lexPgn("﻿1. e4 ; a note e5\n% escaped d4\ne5"))).toEqual(["e4", "e5"]);
  });

  it("hands on only the start of a long comment", () => {
    const [token] = lexPgn(`{${"x".repeat(KEPT_COMMENT_CHARS + 100)}}`);
    expect(token).toEqual({ kind: "comment", text: "x".repeat(KEPT_COMMENT_CHARS) });
  });

  it("gives the same tokens however the text is split into pieces", () => {
    const whole = lexPgn(fixture);
    for (const size of [1, 7, 64, 1000]) {
      const tokens: PgnToken[] = [];
      const lexer = createPgnLexer((token) => tokens.push(token));
      for (let i = 0; i < fixture.length; i += size) lexer.push(fixture.slice(i, i + size));
      lexer.end();
      expect(tokens).toEqual(whole);
    }
  });
});

describe("lexPgn on broken input", () => {
  it("reports a comment that is too long once, and reads on after it", () => {
    const tokens = lexPgn(`1. e4 {${"x".repeat(MAX_COMMENT_CHARS * 2)}} e5`);
    expect(errors(tokens)).toEqual(["comment"]);
    expect(moves(tokens)).toEqual(["e4", "e5"]);
  });

  it("ends a comment never closed at the next game's headers", () => {
    const tokens = lexPgn('1. e4 {never closed\n2. d4\n[Event "Next"]\n1. c4');
    expect(errors(tokens)).toEqual(["comment"]);
    expect(tokens).toContainEqual({ kind: "header", name: "Event", value: "Next" });
    expect(moves(tokens)).toEqual(["e4", "c4"]);
  });

  it("keeps a clock that starts a line inside a comment", () => {
    expect(lexPgn("{ \n[%clk 0:01:00] }")).toEqual([{ kind: "comment", text: " \n[%clk 0:01:00] " }]);
  });

  it("reports a comment left open at the end", () => {
    expect(errors(lexPgn("1. e4 { open"))).toEqual(["comment"]);
  });

  it("reports headers that are unclosed, malformed or too long", () => {
    expect(errors(lexPgn('[Event "open\n1. e4'))).toEqual(["header"]);
    expect(moves(lexPgn('[Event "open\n1. e4'))).toEqual(["e4"]);
    expect(errors(lexPgn("[Event no quotes]"))).toEqual(["header"]);
    expect(errors(lexPgn(`[Event "${"x".repeat(MAX_HEADER_CHARS)}"]\n1. e4`))).toEqual(["header"]);
    expect(errors(lexPgn('[Event "open'))).toEqual(["header"]);
  });

  it("reports a run of letters too long to be a move once", () => {
    const tokens = lexPgn(`1. e4 ${"a".repeat(10_000)} e5`);
    expect(errors(tokens)).toEqual(["symbol"]);
    expect(moves(tokens)).toEqual(["e4", "e5"]);
  });

  it("treats other characters as spaces", () => {
    expect(moves(lexPgn("1.\u0000e4�e5 \u{1F600} Nf3"))).toEqual(["e4", "e5", "Nf3"]);
  });
});
