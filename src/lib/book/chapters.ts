// Which chapter of the book an address is in (plans/book-ui.md D13): the chapters are the
// book's pages in `NAV_ITEMS` order, and a page below one, such as a Library book's page, is
// in its chapter, as its second level (D8).

import { BOOKSTORE_HREF, LIBRARY_HREF } from "@/lib/library/links";

/**
 * The index of the chapter `pathname` is in: the one whose address is the path, or the
 * longest one the path goes on below. -1 when it is in none.
 */
export function chapterAt(pathname: string, hrefs: readonly string[]): number {
  let best = -1;
  hrefs.forEach((href, i) => {
    const inside = pathname === href || pathname.startsWith(`${href}/`);
    if (inside && (best === -1 || href.length > hrefs[best].length)) best = i;
  });
  return best;
}

/** A page's level in its chapter (D8): 1 for the chapter's own page, 2 for a page below it, such as a Library book's. */
export type Level = 1 | 2;

/** The level of `pathname` in the chapter whose address is `href`. */
export function levelAt(pathname: string, href: string): Level {
  return pathname === href ? 1 : 2;
}

/**
 * Chapters whose second levels are shown as a whole spread, which the camera doesn't zoom in on
 * (an exception to D8): the Library, whose game history and books' pages use both pages
 * (plans/game-history.md D30, D40), and the Bookstore, whose books' pages do too
 * (plans/bookstore.md D24).
 */
export const WHOLE_SPREAD_CHAPTERS: readonly string[] = [LIBRARY_HREF, BOOKSTORE_HREF];

/** Whether the camera zooms in on the right page at `pathname` (D8): a second level, unless it is a whole spread. */
export function zoomsAt(pathname: string, level: Level): boolean {
  return level === 2 && !WHOLE_SPREAD_CHAPTERS.some((href) => pathname.startsWith(`${href}/`));
}

/** How far into the book chapter `at` of `pages` is, from 0 at the first to 1 at the last. */
export function bookOrder(at: number, pages: number): number {
  return pages <= 1 || at < 0 ? 0 : Math.min(1, at / (pages - 1));
}

/** A chapter's number as the folio shows it, in Roman numerals: 1 is "I", 8 is "VIII". */
export function roman(n: number): string {
  const steps: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [value, numeral] of steps) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}
