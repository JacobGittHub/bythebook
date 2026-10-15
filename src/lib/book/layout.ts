// The book's layout (plans/book-ui.md D1, D3, D4, D8, D15): for a window, where the pages, the
// cover, the stacks of page edges, the bookmarks and, in the one-page form, the chapter slots
// and page tabs lie. Pure and free of the DOM, so its invariants are tested in Node
// (layout.test.ts) and the browser tests can hold the rendered book to it. The strip's tabs are
// text, so their spans come in measured; everything else is worked out here.
//
// Every rectangle is in window pixels, from the window's top left, except where a comment says
// it is the page's: those are from the inside of the page's border, as CSS's `left` and `top`
// are for an absolutely placed child. The frame draws the book with CSS made from these
// constants (frameCss.ts), so the server render is in place before any script runs; nothing
// is rounded, as CSS doesn't round.

export type BookForm = "spread" | "single";
export type PageSide = "left" | "right" | "single";
/** The one-page form's chapter column: chapter names with figures, or icons only. */
export type ChapterColumn = "names" | "icons";

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
/** A horizontal stretch of the window, such as a tab in the strip. */
export type Span = { x: number; width: number };

/** The page's border. The spine side has none: the gutter's shadow and the crease take its place. */
export const PAGE_BORDER = 1;

/** Where a page's text sits inside its border. `outer` is the fore-edge side, `gutter` the spine side. */
type PagePadding = {
  top: number;
  bottom: number;
  outer: number;
  gutter: number;
  /** The running head's and the folio's height. */
  head: number;
  folio: number;
  /** Between the running head or folio and the body. */
  body: number;
};

/** The spread (D1, D3). */
export const SPREAD = {
  /** The strip across the top: brand, tabs, vibes switch, account links. */
  strip: 50,
  /** Between the strip and the pages, and between the pages and the window's bottom. */
  top: 14,
  bottom: 22,
  /** Between the cover and the window's sides. */
  deskGap: 6,
  /** How far the cover shows past the pages and the stacks of page edges. */
  cover: { top: 8, bottom: 10, side: 9 },
  /** The stacks' thickness, at the first page and at the last (D3). */
  edges: { min: 4, max: 20 },
  page: { top: 30, bottom: 14, outer: 34, gutter: 40, head: 22, folio: 22, body: 12 } satisfies PagePadding,
} as const;

/** The one-page form (D15) on a tablet or a narrow window. */
export const SINGLE = {
  column: { names: 214, icons: 70 },
  /** Between the window's top and bottom and the page. */
  margin: 18,
  /** The chapter rows: the first one's top, and each one's height and the gap below it. */
  slots: { top: 78, height: 32, gap: 2 },
  edges: { min: 3, max: 10 },
  /** How far the page tab reaches past the thickest stack, to meet the column. */
  tabReach: 10,
  /** The facing page past the gutter: how much of it shows, and how much runs off the window. */
  facing: { shown: 56, hidden: 48 },
  cover: { top: 7, bottom: 9, side: 7, lip: 1 },
  page: { top: 16, bottom: 12, outer: 30, gutter: 44, head: 22, folio: 22, body: 12 } satisfies PagePadding,
  /** Between the page's two halves where they sit side by side, the rule included. */
  halfGap: 25,
} as const;

/** The one-page form on a phone: icons only, and everything around the page as thin as it goes. */
export const PHONE = {
  column: { names: 48, icons: 48 },
  margin: 10,
  slots: { top: 54, height: 40, gap: 4 },
  edges: { min: 2, max: 8 },
  tabReach: 4,
  facing: { shown: 12, hidden: 20 },
  cover: { top: 7, bottom: 9, side: 7, lip: 1 },
  page: { top: 12, bottom: 10, outer: 12, gutter: 20, head: 22, folio: 22, body: 12 } satisfies PagePadding,
  halfGap: 25,
} as const;

/** A page's tab reaches this far onto the page past its fore-edge (D15). */
export const PAGE_TAB_IN = 15;
/** The bookmark's width (D4), and how far it keeps from either side of its page. */
export const BOOKMARK_WIDTH = 14;
export const BOOKMARK_INSET = 10;

/** The narrowest board a spread's page holds; below the window width that gives it, the book is one page (D15). */
export const SPREAD_BOARD_MIN = 440;
/** Each half of a one-page spread is at least this wide to sit beside the other; narrower, they stack. */
export const HALF_MIN = 320;
/** Windows narrower than this are phones. */
export const PHONE_MAX_WIDTH = 640;
/** The chapter column shows names from this window width up, and icons below it. */
export const CHAPTER_NAMES_MIN_WIDTH = 900;

/** How much of the left page a second level leaves in view at the window's edge (D8, D9). */
export const SLIDE_SHOWN = 300;

/** The spread's side margin: room for the thickest stack of page edges and the cover beside it. */
const SPREAD_SIDE = SPREAD.deskGap + SPREAD.cover.side + SPREAD.edges.max;

/**
 * The narrowest window that gets the spread: there the left page's body is `SPREAD_BOARD_MIN`
 * wide. The body is the left page's width less its border and padding, and the left page is
 * half the book, which is the window less the side margins.
 */
export const SPREAD_MIN_WIDTH =
  2 * (SPREAD_BOARD_MIN + PAGE_BORDER + SPREAD.page.outer + SPREAD.page.gutter) + 2 * SPREAD_SIDE;

/** The form a window gets (D15). */
export function formFor(window: Size): BookForm {
  return window.width >= SPREAD_MIN_WIDTH ? "spread" : "single";
}

/** The chapter column a window gets by default; a phone always gets icons. */
export function chaptersFor(window: Size): ChapterColumn {
  return window.width >= CHAPTER_NAMES_MIN_WIDTH ? "names" : "icons";
}

export type BookInput = {
  window: Size;
  form: BookForm;
  /** The current page's place in book order, from 0, and how many pages the book has. */
  at: number;
  pages: number;
  /**
   * A second level (D8, D9): how much of the left page stays in view at the window's left edge,
   * or null when the book isn't slid. Only the spread slides; a second level of the one-page form
   * is a page of its own.
   */
  slide: number | null;
  /** The spread's tabs in the strip, measured, in book order. */
  tabs: readonly Span[];
  /** The one-page form's chapter column. A phone shows icons whatever this says. */
  chapters: ChapterColumn;
};

export type PageBox = {
  side: PageSide;
  /** The page, its border included. */
  rect: Rect;
  /** Where the page's content goes: inside the padding, between the running head and the folio. */
  body: Rect;
};

/** A bookmark (D4): which page it lies on, and its middle from the inside of that page's left border. */
export type BookmarkPlace = { side: "left" | "right"; x: number };

type Common = {
  /** Where the book lies: the window below the strip, or all of it beside the chapter column. */
  desk: Rect;
  /** The strip, or the chapter column. */
  nav: Rect;
  cover: Rect;
  /** The stacks of page edges, outside the pages. */
  edges: { left: Rect; right: Rect };
};

export type SpreadLayout = Common & {
  form: "spread";
  /** The left page, then the right. */
  pages: [PageBox, PageBox];
  /** Each tab's bookmark, in the order of `tabs`; null where no page lies under the tab. */
  bookmarks: (BookmarkPlace | null)[];
};

export type SingleLayout = Common & {
  form: "single";
  pages: [PageBox];
  chapters: ChapterColumn;
  /** The facing page, past the gutter and on off the window's right edge. */
  facing: Rect;
  /** The page body's columns: the spread's two halves side by side, or one where they stack. */
  columns: Rect[];
  /** Each chapter's row in the column, in book order. */
  slots: Rect[];
  /** Each chapter's page tab, from the inside of the page's border, level with its slot. */
  pageTabs: Rect[];
};

export type BookLayout = SpreadLayout | SingleLayout;

/** Lays out the book for a window. The same input always gives the same output. */
export function layoutBook(input: BookInput): BookLayout {
  return input.form === "spread" ? layoutSpread(input) : layoutSingle(input);
}

/**
 * How thick the stack of page edges is with `before` pages before it, out of `pages`: thin at
 * the start of the book and thick at its end, whatever its length.
 */
export function edgeThickness(before: number, pages: number, edges: { min: number; max: number }): number {
  if (pages <= 1) return edges.min;
  return edges.min + ((edges.max - edges.min) * clamp(before, 0, pages - 1)) / (pages - 1);
}

function layoutSpread({ window, at, pages, slide, tabs }: BookInput): SpreadLayout {
  const top = SPREAD.strip + SPREAD.top;
  const height = window.height - SPREAD.bottom - top;
  const bookLeft = SPREAD_SIDE;
  const bookRight = window.width - SPREAD_SIDE;
  const leftWidth = (bookRight - bookLeft) / 2;

  // Slid, the left page keeps its width and moves left until `slide` of it shows; the right page
  // keeps its right edge and takes the rest.
  const spine = slide === null ? bookLeft + leftWidth : clamp(slide, 0, bookLeft + leftWidth);
  const left: Rect = { x: spine - leftWidth, y: top, width: leftWidth, height };
  const right: Rect = { x: spine, y: top, width: bookRight - spine, height };

  const page = (side: "left" | "right", rect: Rect): PageBox => ({ side, rect, body: pageBody(side, rect, SPREAD.page) });
  const pagesOut: [PageBox, PageBox] = [page("left", left), page("right", right)];
  const { edges, cover } = stacksAndCover(left, right, at, pages, SPREAD.edges, SPREAD.cover);

  return {
    form: "spread",
    desk: { x: 0, y: SPREAD.strip, width: window.width, height: window.height - SPREAD.strip },
    nav: { x: 0, y: 0, width: window.width, height: SPREAD.strip },
    pages: pagesOut,
    cover,
    edges,
    bookmarks: tabs.map((tab) => placeBookmark(tab, left, right)),
  };
}

function layoutSingle({ window, at, pages, chapters }: BookInput): SingleLayout {
  const phone = window.width < PHONE_MAX_WIDTH;
  const m = phone ? PHONE : SINGLE;
  const column: ChapterColumn = phone ? "icons" : chapters;
  const columnWidth = m.column[column];
  const tabOut = m.edges.max + m.tabReach;

  const x = columnWidth + tabOut;
  const rect: Rect = {
    x,
    y: m.margin,
    width: window.width - m.facing.shown - x,
    height: window.height - 2 * m.margin,
  };
  const facing: Rect = { x: rect.x + rect.width, y: rect.y, width: m.facing.shown + m.facing.hidden, height: rect.height };
  const body = pageBody("single", rect, m.page);
  const { edges, cover } = stacksAndCover(rect, facing, at, pages, m.edges, m.cover, m.cover.lip);

  const halfWidth = (body.width - m.halfGap) / 2;
  const columns =
    halfWidth >= HALF_MIN
      ? [
          { ...body, width: halfWidth },
          { ...body, x: body.x + halfWidth + m.halfGap, width: body.width - halfWidth - m.halfGap },
        ]
      : [body];

  const slots = Array.from({ length: pages }, (_, i) => ({
    x: 0,
    y: m.slots.top + i * (m.slots.height + m.slots.gap),
    width: columnWidth,
    height: m.slots.height,
  }));
  // A page tab runs from the column's edge, past the stack of page edges, onto the page.
  const inside = { x: rect.x + PAGE_BORDER, y: rect.y + PAGE_BORDER };
  const pageTabs = slots.map((slot) => ({
    x: slot.x + slot.width - inside.x,
    y: slot.y - inside.y,
    width: inside.x + PAGE_TAB_IN - (slot.x + slot.width),
    height: slot.height,
  }));

  return {
    form: "single",
    desk: { x: 0, y: 0, width: window.width, height: window.height },
    nav: { x: 0, y: 0, width: columnWidth, height: window.height },
    pages: [{ side: "single", rect, body }],
    chapters: column,
    facing,
    columns,
    cover,
    edges,
    slots,
    pageTabs,
  };
}

/**
 * The stacks of page edges outside `first` (at its left) and `last` (at its right), and the
 * cover behind them. `lip` replaces the cover's side margin at the left, where the one-page
 * form's cover shows only a lip past its stack.
 */
function stacksAndCover(
  first: Rect,
  last: Rect,
  at: number,
  pages: number,
  edgeRange: { min: number; max: number },
  coverMargin: { top: number; bottom: number; side: number },
  lip = coverMargin.side,
) {
  const leftThickness = edgeThickness(at, pages, edgeRange);
  const rightThickness = edgeThickness(pages - 1 - at, pages, edgeRange);
  // The stacks stop short of the pages' top and bottom corners.
  const inset = 3;
  const edges = {
    left: { x: first.x - leftThickness, y: first.y + inset, width: leftThickness, height: first.height - 2 * inset },
    right: { x: last.x + last.width, y: last.y + inset, width: rightThickness, height: last.height - 2 * inset },
  };
  const coverLeft = edges.left.x - lip;
  const coverRight = edges.right.x + rightThickness + coverMargin.side;
  const cover: Rect = {
    x: coverLeft,
    y: first.y - coverMargin.top,
    width: coverRight - coverLeft,
    height: first.height + coverMargin.top + coverMargin.bottom,
  };
  return { edges, cover };
}

/** The page's body: inside its border and padding, between its running head and its folio. */
function pageBody(side: PageSide, rect: Rect, p: PagePadding): Rect {
  // A left or single page has its spine at the right, a right page at the left; the spine side has no border.
  const spineRight = side !== "right";
  const borderLeft = spineRight ? PAGE_BORDER : 0;
  const borderRight = spineRight ? 0 : PAGE_BORDER;
  const padLeft = spineRight ? p.outer : p.gutter;
  const padRight = spineRight ? p.gutter : p.outer;
  const x = rect.x + borderLeft + padLeft;
  const y = rect.y + PAGE_BORDER + p.top + p.head + p.body;
  return {
    x,
    y,
    width: rect.width - borderLeft - borderRight - padLeft - padRight,
    height: rect.height - 2 * PAGE_BORDER - p.top - p.bottom - p.head - p.folio - 2 * p.body,
  };
}

/**
 * A tab's bookmark lands on the page under the tab's middle, moved in from the page's sides if
 * it would reach them, as long as it stays under the tab. If it can't there, it tries the other
 * page; if neither can take it, the tab has no bookmark.
 */
function placeBookmark(tab: Span, left: Rect, right: Rect): BookmarkPlace | null {
  const middle = tab.x + tab.width / 2;
  const order: ["left" | "right", Rect][] =
    middle < right.x ? [["left", left], ["right", right]] : [["right", right], ["left", left]];
  for (const [side, page] of order) {
    const inside = page.x + (side === "left" ? PAGE_BORDER : 0);
    const lo = page.x + BOOKMARK_INSET + BOOKMARK_WIDTH / 2;
    const hi = page.x + page.width - BOOKMARK_INSET - BOOKMARK_WIDTH / 2;
    if (lo > hi) continue;
    const x = clamp(middle, lo, hi);
    if (x >= tab.x && x <= tab.x + tab.width) return { side, x: x - inside };
  }
  return null;
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * The window sizes the book is checked at, here and in the browser tests: desktops and laptops
 * (the spread), a tablet each way and a small laptop (the one-page form), and three phones.
 */
export const BOOK_WINDOW_SIZES: readonly ({ name: string } & Size)[] = [
  { name: "large desktop", width: 1920, height: 1080 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "small laptop", width: 1366, height: 768 },
  { name: "short laptop", width: 1280, height: 720 },
  { name: "narrowest spread", width: SPREAD_MIN_WIDTH, height: 700 },
  { name: "tablet, landscape", width: 1024, height: 768 },
  { name: "tablet, portrait", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
  { name: "small phone", width: 375, height: 667 },
  { name: "narrow phone", width: 360, height: 740 },
];
