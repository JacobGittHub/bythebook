import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { summarize } from "./summary";
import { LibraryError, type BookDraft } from "./types";
import { byNewest, checkedDraft, checkedPatch, entryOf, newBook, nextUpdatedAt, patchedBook } from "./writes";

const treesOf = (...lines: string[]) => [buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN)];
const NOW = new Date("2026-10-07T12:00:00.000Z");

const draft: BookDraft = { name: "  Queen's   Gambit ", color: "white", origin: { kind: "own" }, trees: treesOf("d4 d5 c4") };

function refusal(work: () => unknown) {
  try {
    work();
  } catch (error) {
    return error instanceof LibraryError ? error.code : "not a LibraryError";
  }
  return "accepted";
}

describe("library writes", () => {
  it("store a draft with its name cleaned, its trees replayed and its summary worked out", () => {
    const book = newBook(checkedDraft(draft), "id-1", NOW);
    expect(book).toMatchObject({ id: "id-1", name: "Queen's Gambit", updatedAt: NOW.toISOString() });
    expect(book.summary).toEqual(summarize(book.trees, "white"));
    expect(book.summary.positions).toBe(3);
  });

  it("refuse a bad name, side, origin or tree", () => {
    expect(refusal(() => checkedDraft({ ...draft, name: "   " }))).toBe("invalid");
    expect(refusal(() => checkedDraft({ ...draft, name: "x".repeat(31) }))).toBe("invalid");
    expect(refusal(() => checkedDraft({ ...draft, color: "red" as "white" }))).toBe("invalid");
    expect(refusal(() => checkedDraft({ ...draft, origin: { kind: "stolen" } as unknown as BookDraft["origin"] }))).toBe("invalid");
    const illegal = [{ fen: START_FEN, children: [{ uci: "e2e5", children: [] }] }] as unknown as BookDraft["trees"];
    expect(refusal(() => checkedDraft({ ...draft, trees: illegal }))).toBe("invalid");
    expect(refusal(() => checkedPatch({ name: "" }))).toBe("invalid");
  });

  it("change a book only from the version it was read at", () => {
    const book = newBook(checkedDraft(draft), "id-1", NOW);
    const later = new Date(NOW.getTime() + 5_000);
    expect(refusal(() => patchedBook(book, {}, "2026-10-07T11:00:00.000Z", later))).toBe("stale");

    const renamed = patchedBook(book, checkedPatch({ name: "QGD" }), book.updatedAt, later);
    expect(renamed.name).toBe("QGD");
    expect(renamed.summary).toBe(book.summary);
    expect(renamed.updatedAt).toBe(later.toISOString());
  });

  it("work out the summary again when the trees or the side change", () => {
    const book = newBook(checkedDraft(draft), "id-1", NOW);
    const grown = patchedBook(book, checkedPatch({ trees: treesOf("d4 d5 c4", "d4 Nf6") }), book.updatedAt, NOW);
    expect(grown.summary.positions).toBe(4);
    const black = patchedBook(book, checkedPatch({ color: "black" }), book.updatedAt, NOW);
    expect(black.summary).toEqual(summarize(book.trees, "black"));
  });

  it("stamp every change after the one before, even in the same millisecond", () => {
    const at = NOW.toISOString();
    expect(nextUpdatedAt(at, NOW)).toBe("2026-10-07T12:00:00.001Z");
    expect(nextUpdatedAt(at, new Date(NOW.getTime() - 60_000))).toBe("2026-10-07T12:00:00.001Z");
    expect(nextUpdatedAt("", NOW)).toBe(at);
  });

  it("list the newest change first, then by id", () => {
    const book = newBook(checkedDraft(draft), "b", NOW);
    const entries = [
      entryOf(book),
      { ...entryOf(book), id: "a" },
      { ...entryOf(book), id: "c", updatedAt: "2026-10-08T00:00:00.000Z" },
    ];
    expect(entries.sort(byNewest).map((entry) => entry.id)).toEqual(["c", "a", "b"]);
    expect(entryOf(book)).not.toHaveProperty("trees");
  });
});
