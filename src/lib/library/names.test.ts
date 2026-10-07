import { describe, expect, it } from "vitest";
import { MAX_BOOK_NAME, checkBookName, copyName } from "./names";

describe("book names", () => {
  it("are trimmed and checked for length", () => {
    expect(checkBookName("  Queen's   Gambit ")).toBe("Queen's Gambit");
    expect(checkBookName("   ")).toBeNull();
    expect(checkBookName("x".repeat(MAX_BOOK_NAME))).toHaveLength(MAX_BOOK_NAME);
    expect(checkBookName("x".repeat(MAX_BOOK_NAME + 1))).toBeNull();
  });

  it("name a copy after the first free '(copy)' name, ignoring case", () => {
    expect(copyName("London", ["London"])).toBe("London (copy)");
    expect(copyName("London", ["London", "london (COPY)"])).toBe("London (copy 2)");
    expect(copyName("London (copy)", ["London", "London (copy)"])).toBe("London (copy 2)");
  });

  it("keep a copy's name within the limit", () => {
    const long = "y".repeat(MAX_BOOK_NAME);
    const name = copyName(long, [long]);
    expect(name).toHaveLength(MAX_BOOK_NAME);
    expect(name.endsWith(" (copy)")).toBe(true);
  });
});
