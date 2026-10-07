import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { BACKUP_KIND, canonicalJson, readBackup, writeBackup } from "./backup";
import { summarize } from "./summary";
import type { LibraryBook } from "./types";

const treeOf = (...lines: string[]) => buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN);

function bookOf(id: string, name: string, ...lines: string[]): LibraryBook {
  const trees = [treeOf(...lines)];
  return {
    id,
    name,
    color: "white",
    origin: { kind: "own" },
    summary: summarize(trees, "white"),
    updatedAt: "2026-10-07T12:00:00.000Z",
    trees,
  };
}

const books = [
  bookOf("b1", "Queen's Gambit", "d4 d5 c4 e6", "d4 d5 c4 c6"),
  { ...bookOf("b2", "Italian", "e4 e5 Nf3 Nc6 Bc4"), origin: { kind: "combined" as const, sources: ["b1"] } },
];
const NOW = new Date("2026-10-07T13:00:00.000Z");

describe("the backup file", () => {
  it("round-trips every book with its origin", async () => {
    const read = await readBackup(await writeBackup(books, NOW));
    expect(read).toEqual({
      ok: true,
      exportedAt: NOW.toISOString(),
      books: books.map(({ id, name, color, origin, trees }) => ({ ok: true, book: { id, name, color, origin, trees } })),
    });
  });

  it("is refused as damaged when any byte of a book changes", async () => {
    const text = await writeBackup(books, NOW);
    expect(text).toContain('"uci":"c7c6"');
    expect(await readBackup(text.replace('"uci":"c7c6"', '"uci":"c7c5"'))).toEqual({ ok: false, problem: "damaged" });
    expect(await readBackup(text.replace("Italian", "Italiam"))).toEqual({ ok: false, problem: "damaged" });
  });

  it("doesn't depend on key order", async () => {
    const parsed = JSON.parse(await writeBackup(books, NOW));
    const reordered = JSON.stringify({ sha256: parsed.sha256, books: parsed.books, exportedAt: parsed.exportedAt, version: 1, kind: BACKUP_KIND });
    expect((await readBackup(reordered)).ok).toBe(true);
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: undefined }] })).toBe('{"a":[{"d":2}],"b":1}');
  });

  it("refuses other files, and lists a bad book while the rest restore", async () => {
    expect(await readBackup("not json")).toEqual({ ok: false, problem: "not_backup" });
    expect(await readBackup('{"kind":"other","version":1}')).toEqual({ ok: false, problem: "not_backup" });
    expect(await readBackup(`{"kind":"${BACKUP_KIND}","version":2}`)).toEqual({ ok: false, problem: "newer_version" });

    // A file whose checksum matches but whose moves are illegal: Restore replays every move.
    const forged = await writeBackup(
      [books[0], { ...books[1], trees: [{ ...books[1].trees[0], children: [{ ...books[1].trees[0].children[0], uci: "e2e5" }] }] }],
      NOW,
    );
    const read = await readBackup(forged);
    expect(read.ok && read.books.map((book) => book.ok)).toEqual([true, false]);
    expect(read.ok && read.books[1]).toMatchObject({ ok: false, name: "Italian", problem: "invalid" });
  });
});
