import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { browserLibraryNamed, onBrowserLibraryChange } from "./browserStore";
import { LibraryError, MAX_LIBRARY_BOOKS, type BookDraft } from "./types";

// The browser library on an IndexedDB that lives in memory (fake-indexeddb). Each test opens a
// database of its own; Playwright covers a real browser's.

const treesOf = (...lines: string[]) => [buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN)];
const draft = (name: string): BookDraft => ({ name, color: "white", origin: { kind: "own" }, trees: treesOf("e4 e5") });

let count = 0;
const fresh = () => browserLibraryNamed(`test-library-${++count}`);

async function refusal(work: Promise<unknown>) {
  try {
    await work;
  } catch (error) {
    return error instanceof LibraryError ? error.code : String(error);
  }
  return "accepted";
}

const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

describe("the browser library", () => {
  it("keeps books, lists them newest first without trees, and opens one with its trees", async () => {
    const library = fresh();
    const first = await library.create(draft("First"));
    const second = await library.create(draft("Second"));
    expect(first.summary.positions).toBe(2);

    const list = await library.list();
    expect(list.map((book) => book.name)).toEqual(["Second", "First"]);
    expect(list[0]).not.toHaveProperty("trees");

    const opened = await library.get(second.id);
    expect(opened?.trees[0].children[0].san).toBe("e4");
    expect(await library.get("missing")).toBeNull();
  });

  it("refuses a change from a copy that is out of date, and keeps the newer one", async () => {
    const library = fresh();
    const book = await library.create(draft("Book"));
    const changed = await library.update(book.id, { trees: treesOf("e4 e5", "e4 c5") }, book.updatedAt);
    expect(changed.summary.positions).toBe(3);
    expect(changed.updatedAt > book.updatedAt).toBe(true);

    expect(await refusal(library.update(book.id, { name: "Old tab" }, book.updatedAt))).toBe("stale");
    expect((await library.get(book.id))?.name).toBe("Book");

    const renamed = await library.update(book.id, { name: "Open Sicilian" }, changed.updatedAt);
    const opened = await library.get(book.id);
    expect(opened).toMatchObject({ name: "Open Sicilian", updatedAt: renamed.updatedAt });
    expect(opened?.summary.positions).toBe(3);
  });

  it("refuses what the account would refuse", async () => {
    const library = fresh();
    expect(await refusal(library.create(draft("")))).toBe("invalid");
    const illegal = [{ fen: START_FEN, children: [{ uci: "e2e5", children: [] }] }] as unknown as BookDraft["trees"];
    expect(await refusal(library.create({ ...draft("Bad"), trees: illegal }))).toBe("invalid");
    expect(await refusal(library.update("missing", { name: "x" }, ""))).toBe("not_found");
    expect(await refusal(library.remove("missing"))).toBe("not_found");
    expect(await library.list()).toEqual([]);
  });

  it("holds at most MAX_LIBRARY_BOOKS books", async () => {
    const library = fresh();
    for (let i = 0; i < MAX_LIBRARY_BOOKS; i++) await library.create({ ...draft(`Book ${i}`), trees: [] });
    expect(await refusal(library.create(draft("One more")))).toBe("full");
    expect(await library.list()).toHaveLength(MAX_LIBRARY_BOOKS);
  });

  it("deletes a book with its trees", async () => {
    const library = fresh();
    const book = await library.create(draft("Gone"));
    await library.remove(book.id);
    expect(await library.get(book.id)).toBeNull();
    expect(await library.list()).toEqual([]);
  });

  it("remembers the last backup and whether a book changed since", async () => {
    const library = fresh();
    expect(await library.backupState()).toEqual({ lastBackupAt: null, changedSinceBackup: false });
    const book = await library.create(draft("Book"));
    expect((await library.backupState()).changedSinceBackup).toBe(true);

    const at = new Date("2026-10-07T12:00:00.000Z");
    await library.recordBackup(at);
    expect(await library.backupState()).toEqual({ lastBackupAt: at.toISOString(), changedSinceBackup: false });
    await library.remove(book.id);
    expect(await library.backupState()).toEqual({ lastBackupAt: at.toISOString(), changedSinceBackup: true });
  });

  it("tells other tabs when it changes", async () => {
    const name = `test-library-${++count}`;
    const library = browserLibraryNamed(name);
    const heard = new Promise<void>((resolve) => stops.push(onBrowserLibraryChange(resolve, name)));
    await library.create(draft("Book"));
    await expect(heard).resolves.toBeUndefined();
  });
});
