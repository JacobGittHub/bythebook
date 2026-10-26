import { describe, expect, it } from "vitest";
import { BANNED_WORDS_MESSAGE } from "@/lib/validators/words";
import { MAX_BOOK_NAME, bookNameProblem, checkBookName, copyName, fitBookName } from "./names";

describe("book names", () => {
  it("are trimmed and checked for length", () => {
    expect(checkBookName("  Queen's   Gambit ")).toBe("Queen's Gambit");
    expect(checkBookName("   ")).toBeNull();
    expect(checkBookName("x".repeat(MAX_BOOK_NAME))).toHaveLength(MAX_BOOK_NAME);
    expect(checkBookName("x".repeat(MAX_BOOK_NAME + 1))).toBeNull();
  });

  it("are refused when they hold a word the list refuses, and say why", () => {
    expect(checkBookName("Sh1t Gambit")).toBeNull();
    expect(bookNameProblem("Sh1t Gambit")).toBe(BANNED_WORDS_MESSAGE);
    expect(bookNameProblem("")).toBe(`A name needs 1 to ${MAX_BOOK_NAME} characters.`);
    expect(bookNameProblem("Fried Liver Attack")).toBeNull();
  });

  it("name a copy after the first free '(copy)' name, ignoring case", () => {
    expect(copyName("London", ["London"])).toBe("London (copy)");
    expect(copyName("London", ["London", "london (COPY)"])).toBe("London (copy 2)");
    expect(copyName("London (copy)", ["London", "London (copy)"])).toBe("London (copy 2)");
  });

  it("from elsewhere are cut to fit, with an ellipsis", () => {
    expect(fitBookName(" Queen's  Gambit ")).toBe("Queen's Gambit");
    const long = fitBookName("Queen's Gambit (master statistics)");
    expect(long).toBe("Queen's Gambit (master statis…");
    expect(checkBookName(long)).toBe(long);
  });

  it("keep a copy's name within the limit", () => {
    const long = "y".repeat(MAX_BOOK_NAME);
    const name = copyName(long, [long]);
    expect(name).toHaveLength(MAX_BOOK_NAME);
    expect(name.endsWith(" (copy)")).toBe(true);
  });
});
