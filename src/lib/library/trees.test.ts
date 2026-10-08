import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { saveBook, saveStartTree, startTree, withStartTree } from "./trees";
import { LibraryError, type Library, type LibraryBook } from "./types";

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("startTree and withStartTree", () => {
  const elsewhere = createRootMoveNode(AFTER_E4);
  const start = { ...createRootMoveNode(START_FEN), id: "start" };

  it("find the tree from the starting position, or give an empty one", () => {
    expect(startTree([elsewhere, start])).toBe(start);
    expect(startTree([elsewhere])).toEqual(createRootMoveNode(START_FEN));
  });

  it("replace that tree in place, or add it first", () => {
    const next = { ...start, id: "next" };
    expect(withStartTree([elsewhere, start], next)).toEqual([elsewhere, next]);
    expect(withStartTree([elsewhere], next)).toEqual([next, elsewhere]);
  });
});

describe("saveBook and saveStartTree", () => {
  const start = createRootMoveNode(START_FEN);
  const book = { id: "a", updatedAt: "1", trees: [start] } as LibraryBook;
  const current = { ...book, updatedAt: "2" };
  const library = (update: Library["update"]) => ({ update, get: async () => current }) as unknown as Library;

  it("saves the tree in place of the one from the starting position", async () => {
    const next = { ...start, id: "next" };
    const saved = await saveStartTree(library(async (_, patch) => ({ ...book, updatedAt: "2", ...patch })), book, next);
    expect(saved).toMatchObject({ saved: true, book: { updatedAt: "2", trees: [next] } });
  });

  it("saves a patch that leaves the trees alone, naming the time it read", async () => {
    let expected: string | undefined;
    const saved = await saveBook(
      library(async (_, patch, expectedUpdatedAt) => {
        expected = expectedUpdatedAt;
        return { ...book, updatedAt: "2", ...patch };
      }),
      book,
      { name: "Renamed" },
    );
    expect(expected).toBe("1");
    expect(saved).toMatchObject({ saved: true, book: { name: "Renamed", trees: [start] } });
  });

  it("passes on any failure but a stale copy", async () => {
    const failing = library(() => Promise.reject(new LibraryError("invalid")));
    await expect(saveBook(failing, book, { name: "x" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("gives back the current book when the copy was out of date", async () => {
    const stale = library(() => Promise.reject(new LibraryError("stale")));
    expect(await saveStartTree(stale, book, start)).toEqual({ book: current, saved: false });
  });
});
