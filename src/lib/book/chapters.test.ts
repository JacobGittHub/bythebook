import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/auth/access";
import { bookOrder, chapterAt, levelAt, roman, zoomsAt } from "./chapters";

const HREFS = NAV_ITEMS.map((item) => item.href);
const index = (href: string) => HREFS.indexOf(href);

describe("chapterAt", () => {
  it("finds a chapter's own page", () => {
    HREFS.forEach((href, i) => expect(chapterAt(href, HREFS)).toBe(i));
  });

  it("puts a page below a chapter in that chapter, not in the Overview above them all", () => {
    expect(chapterAt("/dashboard/library/abc", HREFS)).toBe(index("/dashboard/library"));
    expect(chapterAt("/dashboard/visualizations/books/icicle", HREFS)).toBe(index("/dashboard/visualizations"));
    expect(chapterAt("/dashboard/somewhere", HREFS)).toBe(index("/dashboard"));
  });

  it("finds no chapter outside the book, or for a path that only shares a prefix", () => {
    expect(chapterAt("/auth/login", HREFS)).toBe(-1);
    expect(chapterAt("/dashboardx", HREFS)).toBe(-1);
  });
});

describe("levelAt", () => {
  it("puts a chapter's own page at the first level and every page below it at the second", () => {
    expect(levelAt("/dashboard/library", "/dashboard/library")).toBe(1);
    expect(levelAt("/dashboard/library/abc", "/dashboard/library")).toBe(2);
    expect(levelAt("/dashboard/visualizations/books/icicle", "/dashboard/visualizations")).toBe(2);
  });
});

describe("zoomsAt", () => {
  it("zooms in on a second level, but not on the Library's or the Bookstore's, which are whole spreads", () => {
    expect(zoomsAt("/dashboard/visualizations/treemap", 2)).toBe(true);
    expect(zoomsAt("/dashboard/bookstore/abc", 2)).toBe(false);
    expect(zoomsAt("/dashboard/library/abc", 2)).toBe(false);
    expect(zoomsAt("/dashboard/library/history", 2)).toBe(false);
    expect(zoomsAt("/dashboard/library", 1)).toBe(false);
  });
});

describe("bookOrder", () => {
  it("runs from 0 at the first chapter to 1 at the last, and grows with each", () => {
    expect(bookOrder(0, 8)).toBe(0);
    expect(bookOrder(7, 8)).toBe(1);
    for (let at = 1; at < 8; at++) expect(bookOrder(at, 8)).toBeGreaterThan(bookOrder(at - 1, 8));
    expect(bookOrder(0, 1)).toBe(0);
    expect(bookOrder(-1, 8)).toBe(0);
  });
});

describe("roman", () => {
  it("writes chapter numbers as a book does", () => {
    expect([1, 2, 3, 4, 5, 8, 9, 12, 14, 40].map(roman)).toEqual(["I", "II", "III", "IV", "V", "VIII", "IX", "XII", "XIV", "XL"]);
  });
});
