import { describe, expect, it } from "vitest";
import { mulberry32, type Rng } from "@/lib/regions/prng";
import { expectNoViolations } from "@/lib/regions/testShapes";
import {
  BOOK_WINDOW_SIZES,
  BOOKMARK_INSET,
  BOOKMARK_WIDTH,
  PAGE_BORDER,
  PAGE_TAB_IN,
  PHONE_MAX_WIDTH,
  SPREAD_BOARD_MIN,
  SPREAD_MIN_WIDTH,
  chaptersFor,
  edgeThickness,
  formFor,
  layoutBook,
  type BookForm,
  type BookInput,
  type BookLayout,
  type Rect,
  type Size,
  type Span,
} from "./layout";

/** The Explorer's search row and its book and line controls, above the board on its page (D6). */
const EXPLORER_CONTROLS = 84;
/** The smallest board each kind of window may give the Explorer. */
const BOARD_MIN = { spread: 400, single: 400, phone: 250 };
/** Pixels of rounding a check allows. */
const EPS = 1e-6;

const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;
const show = (r: Rect) => `(${r.x}, ${r.y}, ${r.width}×${r.height})`;

/** Whether `inner` lies inside `outer`, leaving out the sides named in `except`. */
function inside(inner: Rect, outer: Rect, except: ("left" | "right")[] = []) {
  return (
    (except.includes("left") || inner.x >= outer.x - EPS) &&
    (except.includes("right") || right(inner) <= right(outer) + EPS) &&
    inner.y >= outer.y - EPS &&
    bottom(inner) <= bottom(outer) + EPS
  );
}

/** Tabs along the strip, as the shell measures them: in a row from after the brand, with gaps. */
function randomTabs(rng: Rng, window: Size): Span[] {
  const tabs: Span[] = [];
  let x = 120 + rng() * 80;
  const count = 1 + Math.floor(rng() * 9);
  for (let i = 0; i < count && x < window.width; i++) {
    const width = 36 + rng() * 110;
    tabs.push({ x, width });
    x += width + rng() * 12;
  }
  // Now and then a tab anywhere, to reach the spine, the book's far side and past it.
  if (rng() < 0.5) tabs.push({ x: rng() * window.width, width: 36 + rng() * 110 });
  return tabs;
}

function randomInput(rng: Rng, form?: BookForm): BookInput {
  const window = { width: Math.round(320 + rng() * 2300), height: Math.round(480 + rng() * 1100) };
  const pages = 1 + Math.floor(rng() * 12);
  const picked = form ?? (rng() < 0.7 ? formFor(window) : rng() < 0.5 ? "spread" : "single");
  return {
    window: picked === "spread" ? { ...window, width: Math.max(window.width, SPREAD_MIN_WIDTH) } : window,
    form: picked,
    at: Math.floor(rng() * pages),
    pages,
    tabs: randomTabs(rng, window),
    chapters: rng() < 0.5 ? "names" : "icons",
  };
}

/** The input a listed window size gets by default. */
function listedInput(size: Size, at = 0, pages = 8): BookInput {
  return { window: size, form: formFor(size), at, pages, tabs: [], chapters: chaptersFor(size) };
}

/** Every rectangle in a layout, named. */
function rects(layout: BookLayout): [string, Rect][] {
  const out: [string, Rect][] = [
    ["desk", layout.desk],
    ["nav", layout.nav],
    ["cover", layout.cover],
    ["left edges", layout.edges.left],
    ["right edges", layout.edges.right],
  ];
  layout.pages.forEach((p, i) => out.push([`page ${i}`, p.rect], [`page ${i} body`, p.body]));
  if (layout.form === "single") {
    out.push(["facing", layout.facing]);
    layout.columns.forEach((c, i) => out.push([`column ${i}`, c]));
    layout.slots.forEach((s, i) => out.push([`slot ${i}`, s]));
    layout.pageTabs.forEach((t, i) => out.push([`page tab ${i}`, t]));
  }
  return out;
}

/** The box the Explorer's board and its controls share, and the board that fits in it. */
function explorerBoard(layout: BookLayout) {
  const box = layout.form === "spread" ? layout.pages[0].body : layout.columns[0];
  return { box, side: Math.min(box.width, box.height - EXPLORER_CONTROLS) };
}

describe("layoutBook", () => {
  it("never overlaps the pages, and gives every rectangle a real size", () => {
    const rng = mulberry32(1);
    const wrong: string[] = [];
    for (let run = 0; run < 2000; run++) {
      const input = randomInput(rng);
      const layout = layoutBook(input);
      for (const [name, r] of rects(layout)) {
        if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) wrong.push(`run ${run}: ${name} ${show(r)}`);
        if (r.width <= 0 || r.height <= 0) wrong.push(`run ${run}: ${name} is empty ${show(r)}`);
      }
      if (layout.form === "spread") {
        const [l, r] = layout.pages;
        if (right(l.rect) > r.rect.x + EPS) wrong.push(`run ${run}: the left page ${show(l.rect)} overlaps the right ${show(r.rect)}`);
      } else {
        const page = layout.pages[0].rect;
        if (right(page) > layout.facing.x + EPS) wrong.push(`run ${run}: the page overlaps the facing page`);
        if (page.x < right(layout.nav)) wrong.push(`run ${run}: the page overlaps the chapter column`);
      }
      // Every body lies inside its page, and every column inside the body.
      for (const p of layout.pages) {
        if (!inside(p.body, p.rect)) wrong.push(`run ${run}: the ${p.side} page's body ${show(p.body)} leaves ${show(p.rect)}`);
      }
      if (layout.form === "single") {
        for (const c of layout.columns) {
          if (!inside(c, layout.pages[0].body)) wrong.push(`run ${run}: column ${show(c)} leaves the body`);
        }
        if (layout.columns.length === 2 && right(layout.columns[0]) > layout.columns[1].x) {
          wrong.push(`run ${run}: the halves overlap`);
        }
      }
    }
    expectNoViolations(wrong);
  });

  it("keeps everything on the desk, but for what runs off it by design", () => {
    const rng = mulberry32(2);
    const wrong: string[] = [];
    for (let run = 0; run < 2000; run++) {
      const input = randomInput(rng);
      const layout = layoutBook(input);
      const { desk, cover, edges } = layout;

      if (layout.form === "spread") {
        const parts: [string, Rect][] = [
          ["cover", cover],
          ["left edges", edges.left],
          ["right edges", edges.right],
          ["left page", layout.pages[0].rect],
          ["right page", layout.pages[1].rect],
        ];
        for (const [name, r] of parts) {
          if (!inside(r, desk)) wrong.push(`run ${run}: the ${name} ${show(r)} leaves the desk ${show(desk)}`);
        }
        if (layout.nav.height !== desk.y) wrong.push(`run ${run}: the strip and the desk don't meet`);
      } else {
        // The facing page, its stack and the cover's right side run off the window's right edge,
        // and the book lies clear of the chapter column.
        const page = layout.pages[0].rect;
        for (const [name, r] of [["cover", cover], ["left edges", edges.left], ["page", page]] as const) {
          if (!inside(r, desk, ["right"])) wrong.push(`run ${run}: the ${name} ${show(r)} leaves the desk`);
          if (r.x < right(layout.nav)) wrong.push(`run ${run}: the ${name} ${show(r)} reaches the chapter column`);
        }
        if (right(layout.facing) <= desk.width) wrong.push(`run ${run}: the facing page ends in the window`);
        if (right(page) >= desk.width) wrong.push(`run ${run}: no facing page shows`);
        if (right(cover) <= desk.width) wrong.push(`run ${run}: the book ends in the window`);
      }
    }
    expectNoViolations(wrong);
  });

  it("fits the Explorer's board on its page at every listed window size", () => {
    const wrong: string[] = [];
    for (const size of BOOK_WINDOW_SIZES) {
      const layout = layoutBook(listedInput(size));
      const { box, side } = explorerBoard(layout);
      const kind = layout.form === "spread" ? "spread" : size.width < PHONE_MAX_WIDTH ? "phone" : "single";
      if (side < BOARD_MIN[kind]) wrong.push(`${size.name} (${size.width}×${size.height}): a ${side}px board, under ${BOARD_MIN[kind]}`);
      if (side > box.width || side + EXPLORER_CONTROLS > box.height) wrong.push(`${size.name}: the board leaves its page`);
    }
    expectNoViolations(wrong);
  });

  it("gives the spread exactly the windows wide enough for its board (D15)", () => {
    const wrong: string[] = [];
    for (let width = 320; width <= 2600; width++) {
      const window = { width, height: 900 };
      const spread = layoutBook({ ...listedInput(window), form: "spread" });
      const roomy = spread.pages[0].body.width >= SPREAD_BOARD_MIN;
      if (roomy !== (formFor(window) === "spread")) wrong.push(`${width}px: ${formFor(window)}, body ${spread.pages[0].body.width}`);
    }
    expectNoViolations(wrong);
  });

  it("thickens each stack of page edges with book order, and turning moves no page", () => {
    const wrong: string[] = [];
    for (const size of BOOK_WINDOW_SIZES) {
      for (let pages = 2; pages <= 12; pages++) {
        const at = (i: number) => layoutBook(listedInput(size, i, pages));
        const first = at(0);
        for (let i = 0; i + 1 < pages; i++) {
          const here = at(i);
          const next = at(i + 1);
          if (!(next.edges.left.width > here.edges.left.width)) wrong.push(`${size.name}, ${pages} pages: the left stack doesn't grow at ${i + 1}`);
          if (!(next.edges.right.width < here.edges.right.width)) wrong.push(`${size.name}, ${pages} pages: the right stack doesn't shrink at ${i + 1}`);
          next.pages.forEach((p, k) => {
            if (JSON.stringify(p) !== JSON.stringify(first.pages[k])) wrong.push(`${size.name}, ${pages} pages: page ${k} moves at ${i + 1}`);
          });
        }
      }
    }
    expect(edgeThickness(0, 1, { min: 4, max: 20 })).toBe(4);
    expectNoViolations(wrong);
  });

  it("lays every bookmark under its tab and on the page below it (D4)", () => {
    const rng = mulberry32(4);
    const wrong: string[] = [];
    const half = BOOKMARK_WIDTH / 2;
    for (let run = 0; run < 2000; run++) {
      const input = randomInput(rng, "spread");
      const layout = layoutBook(input);
      if (layout.form !== "spread") continue;
      const [left, rightPage] = layout.pages.map((p) => p.rect);
      input.tabs.forEach((tab, i) => {
        const mark = layout.bookmarks[i];
        const middle = tab.x + tab.width / 2;
        const room = BOOKMARK_INSET + half;
        // Where the tab's middle lies well inside a page, the bookmark lies there, right under it.
        const under = [left, rightPage].find((p) => middle >= p.x + room && middle <= right(p) - room);
        if (!mark) {
          if (under) wrong.push(`run ${run}: tab ${i} at ${middle} has no bookmark`);
          return;
        }
        const page = mark.side === "left" ? left : rightPage;
        const x = mark.x + page.x + (mark.side === "left" ? PAGE_BORDER : 0);
        if (x < tab.x - EPS || x > tab.x + tab.width + EPS) wrong.push(`run ${run}: tab ${i}'s bookmark at ${x} isn't under ${tab.x}–${tab.x + tab.width}`);
        if (x - half < page.x || x + half > right(page)) wrong.push(`run ${run}: tab ${i}'s bookmark at ${x} leaves its page ${show(page)}`);
        if (under && (under !== page || Math.abs(x - middle) > EPS)) wrong.push(`run ${run}: tab ${i}'s bookmark isn't at its middle on the page below`);
      });
    }
    expectNoViolations(wrong);
  });

  it("lines every page tab up with its chapter's slot (D15)", () => {
    const rng = mulberry32(5);
    const wrong: string[] = [];
    const inputs = [
      ...BOOK_WINDOW_SIZES.map((size) => ({ ...listedInput(size), form: "single" as const })),
      ...Array.from({ length: 1000 }, () => randomInput(rng, "single")),
    ];
    inputs.forEach((input, run) => {
      const layout = layoutBook(input);
      if (layout.form !== "single") return;
      const page = layout.pages[0].rect;
      const listed = run < BOOK_WINDOW_SIZES.length;
      layout.pageTabs.forEach((tab, i) => {
        const slot = layout.slots[i];
        const x = tab.x + page.x + PAGE_BORDER;
        const y = tab.y + page.y + PAGE_BORDER;
        if (Math.abs(y - slot.y) > EPS || tab.height !== slot.height) wrong.push(`run ${run}: page tab ${i} isn't level with its slot`);
        if (Math.abs(x - right(slot)) > EPS) wrong.push(`run ${run}: page tab ${i} doesn't reach its slot`);
        if (Math.abs(x + tab.width - (page.x + PAGE_BORDER + PAGE_TAB_IN)) > EPS) wrong.push(`run ${run}: page tab ${i} doesn't reach onto its page`);
        if (layout.edges.left.x < right(slot)) wrong.push(`run ${run}: the page edges reach the column`);
        // On a listed window, every chapter's tab lies on its page's fore-edge, clear of the corners.
        if (listed && (y < page.y + 9 || y + tab.height > bottom(page) - 9)) wrong.push(`${input.window.width}×${input.window.height}: page tab ${i} leaves its page`);
      });
      if (layout.slots.length !== input.pages) wrong.push(`run ${run}: ${layout.slots.length} slots for ${input.pages} pages`);
    });
    expectNoViolations(wrong);
  });

  it("gives identical output for identical input", () => {
    const rng = mulberry32(6);
    const wrong: string[] = [];
    for (let run = 0; run < 500; run++) {
      const input = randomInput(rng);
      const a = JSON.stringify(layoutBook(input));
      const b = JSON.stringify(layoutBook(structuredClone(input)));
      if (a !== b) wrong.push(`run ${run}: two layouts differ`);
    }
    expectNoViolations(wrong);
  });
});
