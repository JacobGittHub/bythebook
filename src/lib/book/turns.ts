// How the book turns from one chapter to another (plans/book-ui.md D4, D13): which way, and
// which leaves riffle past on the way. The turn itself is CSS (src/components/book/turns.css).

import { PAGE_BORDER, type BookmarkPlace } from "./layout";

export type TurnWay = "forward" | "back";

/** A jump of several chapters riffles at most this many leaves (D13). */
export const MAX_RIFFLES = 3;

export type Turn = {
  way: TurnWay;
  /** The chapters whose leaves riffle past, in the order they turn. */
  riffled: number[];
};

/**
 * The turn from chapter `from` to chapter `to`, in book order. Null when the page stays in its
 * chapter, or either end is outside the book: those changes never turn.
 */
export function turnBetween(from: number, to: number): Turn | null {
  if (from < 0 || to < 0 || from === to) return null;
  const way: TurnWay = to > from ? "forward" : "back";
  const step = way === "forward" ? 1 : -1;
  const between = Math.abs(to - from) - 1;
  const count = Math.min(MAX_RIFFLES, between);
  // Spread over the chapters between, so a long jump riffles from near its start to near its end.
  const riffled = Array.from({ length: count }, (_, i) => {
    const offset = count === between ? i : Math.round((i * (between - 1)) / (count - 1));
    return from + step * (1 + offset);
  });
  return { way, riffled };
}

/**
 * Where a riffled leaf carries a chapter's bookmark. The leaf starts on `leaf`'s side of the
 * spine and is one picture turned over it, so a bookmark that lies on the other page is drawn
 * at its mirror place, the same distance from the spine, and lands under its tab. `leftWidth`
 * is the left page's width, border included; `x` is measured as `BookmarkPlace` measures it.
 */
export function riffleBookmarkX(mark: BookmarkPlace, leaf: "left" | "right", leftWidth: number): number {
  return mark.side === leaf ? mark.x : leftWidth - PAGE_BORDER - mark.x;
}
