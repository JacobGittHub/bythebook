import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { cachedLibrary } from "./cache";
import { LibraryError, type BookDraft, type Library, type LibraryBook } from "./types";
import { byNewest, checkedDraft, checkedPatch, entryOf, newBook, patchedBook } from "./writes";

const treesOf = (...lines: string[]) => [buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN)];
const draft = (name: string): BookDraft => ({ name, color: "white", origin: { kind: "own" }, trees: treesOf("e4 e5") });

/** A library in memory that counts its reads, standing in for either store. */
function memoryLibrary() {
  const books = new Map<string, LibraryBook>();
  const reads = { list: 0, get: 0 };
  let clock = Date.parse("2026-10-07T12:00:00.000Z");
  const now = () => new Date((clock += 1_000));
  const library: Library = {
    store: "browser",
    async list() {
      reads.list++;
      return [...books.values()].map(entryOf).sort(byNewest);
    },
    async get(id) {
      reads.get++;
      return books.get(id) ?? null;
    },
    async create(input) {
      const book = newBook(checkedDraft(input), `book-${books.size + 1}`, now());
      books.set(book.id, book);
      return entryOf(book);
    },
    async update(id, patch, expectedUpdatedAt) {
      const book = books.get(id);
      if (!book) throw new LibraryError("not_found");
      const next = patchedBook(book, checkedPatch(patch), expectedUpdatedAt, now());
      books.set(id, next);
      return entryOf(next);
    },
    async remove(id) {
      if (!books.delete(id)) throw new LibraryError("not_found");
    },
  };
  /** A change made elsewhere: another tab or device. */
  const elsewhere = (id: string, name: string) => {
    const book = books.get(id)!;
    books.set(id, patchedBook(book, { name }, book.updatedAt, now()));
  };
  return { library, books, reads, elsewhere };
}

describe("the shared library", () => {
  it("reads the list once, and keeps it current through its own writes", async () => {
    const { library: base, reads } = memoryLibrary();
    const library = cachedLibrary(base);
    let heard = 0;
    library.subscribe(() => heard++);

    expect(library.state().books).toBeNull();
    library.load();
    library.load();
    await library.reload();
    expect(reads.list).toBe(2);
    expect(library.state().books).toEqual([]);

    const a = await library.create(draft("A"));
    const b = await library.create(draft("B"));
    expect(library.state().books?.map((book) => book.name)).toEqual(["B", "A"]);

    await library.update(a.id, { name: "A2" }, a.updatedAt);
    expect(library.state().books?.map((book) => book.name)).toEqual(["A2", "B"]);

    await library.remove(b.id);
    expect(library.state().books?.map((book) => book.name)).toEqual(["A2"]);
    expect(reads.list).toBe(2);
    expect(heard).toBeGreaterThan(0);
  });

  it("keeps the same state object until something changes", async () => {
    const library = cachedLibrary(memoryLibrary().library);
    await library.reload();
    const state = library.state();
    expect(library.state()).toBe(state);
    await library.create(draft("A"));
    expect(library.state()).not.toBe(state);
  });

  it("opens a book once, and again only when the list shows it changed", async () => {
    const memory = memoryLibrary();
    const library = cachedLibrary(memory.library);
    await library.reload();
    const a = await library.create(draft("A"));

    const first = await library.get(a.id);
    expect(await library.get(a.id)).toBe(first);
    expect(memory.reads.get).toBe(1);

    memory.elsewhere(a.id, "Changed elsewhere");
    await library.reload();
    expect((await library.get(a.id))?.name).toBe("Changed elsewhere");
    expect(memory.reads.get).toBe(2);
  });

  it("keeps opened trees through a rename, and reads them back after new trees", async () => {
    const memory = memoryLibrary();
    const library = cachedLibrary(memory.library);
    await library.reload();
    const a = await library.create(draft("A"));
    await library.get(a.id);

    const renamed = await library.update(a.id, { name: "A2" }, a.updatedAt);
    expect((await library.get(a.id))?.name).toBe("A2");
    expect(memory.reads.get).toBe(1);

    await library.update(a.id, { trees: treesOf("e4 e5", "d4") }, renamed.updatedAt);
    expect((await library.get(a.id))?.summary.positions).toBe(3);
    expect(memory.reads.get).toBe(2);
  });

  it("forgets an opened book that turned out stale or gone", async () => {
    const memory = memoryLibrary();
    const library = cachedLibrary(memory.library);
    await library.reload();
    const a = await library.create(draft("A"));
    await library.get(a.id);
    memory.elsewhere(a.id, "Elsewhere");

    await expect(library.update(a.id, { name: "Mine" }, a.updatedAt)).rejects.toMatchObject({ code: "stale" });
    expect((await library.get(a.id))?.name).toBe("Elsewhere");
    expect(library.state().books?.[0].name).toBe("Elsewhere");

    memory.books.delete(a.id);
    await expect(library.remove(a.id)).rejects.toMatchObject({ code: "not_found" });
    expect(library.state().books).toEqual([]);
  });

  it("reports a list it couldn't read", async () => {
    const base = memoryLibrary().library;
    const library = cachedLibrary({ ...base, list: () => Promise.reject(new Error("offline")) });
    await library.reload();
    expect(library.state()).toMatchObject({ books: null, error: { code: "failed" } });
    await expect(library.list()).rejects.toBeInstanceOf(LibraryError);
  });
});
