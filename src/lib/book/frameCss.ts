// The book frame's measurements as CSS custom properties, made from the layout's constants
// (layout.ts), so the CSS that draws the book (globals.css § "The book frame") and the layout
// its tests check are one set of numbers. The frame renders this once, as a style sheet; the
// server render is in place before any script runs.

import {
  CHAPTER_NAMES_MIN_WIDTH,
  HALF_MIN,
  PHONE,
  PHONE_MAX_WIDTH,
  SINGLE,
  SPREAD,
  SPREAD_MIN_WIDTH,
  layoutBook,
  type BookForm,
  type Size,
} from "./layout";

type Vars = Record<string, number>;

const declare = (vars: Vars) =>
  Object.entries(vars)
    .map(([name, px]) => `--${name}: ${px}px;`)
    .join(" ");

/**
 * The height of everything around a page's body, which a page that fits its window subtracts
 * from `100dvh` (`--dash-offset`, AGENTS.md § "UI"). It is the same at every window height.
 */
export function bodyOffset(form: BookForm, window: Size): number {
  const layout = layoutBook({ window, form, at: 0, pages: 1, slide: null, tabs: [], chapters: "names" });
  return window.height - layout.pages[0].body.height;
}

function pageVars(page: (typeof SPREAD)["page"] | (typeof SINGLE)["page"] | (typeof PHONE)["page"]): Vars {
  return {
    "page-top": page.top,
    "page-bottom": page.bottom,
    "page-outer": page.outer,
    "page-gutter": page.gutter,
    "page-head": page.head,
    "page-folio": page.folio,
    "page-body": page.body,
  };
}

function singleVars(m: typeof SINGLE | typeof PHONE, column: number, window: Size): Vars {
  return {
    column,
    "book-margin": m.margin,
    "slot-top": m.slots.top,
    "slot-height": m.slots.height,
    "slot-gap": m.slots.gap,
    "edge-min": m.edges.min,
    "edge-max": m.edges.max,
    "tab-out": m.edges.max + m.tabReach,
    "facing-shown": m.facing.shown,
    "facing-hidden": m.facing.hidden,
    "cover-top": m.cover.top,
    "cover-bottom": m.cover.bottom,
    "cover-side": m.cover.side,
    "cover-lip": m.cover.lip,
    "half-gap": m.halfGap,
    ...pageVars(m.page),
    "dash-offset": bodyOffset("single", window),
  };
}

/** The frame's style sheet. */
export function bookFrameCss(): string {
  const spread: Vars = {
    strip: SPREAD.strip,
    "book-top": SPREAD.top,
    "book-bottom": SPREAD.bottom,
    "book-side": SPREAD.deskGap + SPREAD.cover.side + SPREAD.edges.max,
    "cover-top": SPREAD.cover.top,
    "cover-bottom": SPREAD.cover.bottom,
    "cover-side": SPREAD.cover.side,
    "edge-min": SPREAD.edges.min,
    "edge-max": SPREAD.edges.max,
    ...pageVars(SPREAD.page),
    "dash-offset": bodyOffset("spread", { width: SPREAD_MIN_WIDTH, height: 1000 }),
  };
  const tablet = { width: CHAPTER_NAMES_MIN_WIDTH, height: 1000 };
  const phone = { width: PHONE_MAX_WIDTH - 1, height: 1000 };
  const halvesSideBySide = 2 * HALF_MIN + SINGLE.halfGap;

  return [
    `.book-frame[data-form="spread"] { ${declare(spread)} }`,
    `.book-frame[data-form="single"] { ${declare(singleVars(SINGLE, SINGLE.column.names, tablet))} }`,
    // Narrower, the chapter column shows icons; on a phone, everything around the page thins.
    `@media (width < ${CHAPTER_NAMES_MIN_WIDTH}px) {`,
    `  .book-frame[data-form="single"] { --column: ${SINGLE.column.icons}px; }`,
    `  .book-frame[data-form="single"] .book-chapter-text { display: none; }`,
    `  .book-frame[data-form="single"] :is(.book-chapters-head, .book-chapter, .book-chapters-foot > *) { justify-content: center; padding-inline: 0; }`,
    `}`,
    `@media (width < ${PHONE_MAX_WIDTH}px) {`,
    `  .book-frame[data-form="single"] { ${declare(singleVars(PHONE, PHONE.column.icons, phone))} }`,
    `}`,
    // The server can't see the window, so it renders the form the last visit had (or the
    // spread); until the script has the right one, a frame of the wrong form isn't laid out.
    // On a first visit from a phone, the page therefore mounts twice.
    `@media (width < ${SPREAD_MIN_WIDTH}px) { .book-frame[data-form="spread"] { display: none; } }`,
    `@media (width >= ${SPREAD_MIN_WIDTH}px) { .book-frame[data-form="single"] { display: none; } }`,
    // A one-page spread's halves sit side by side where each has room, and stack where not.
    `@container book-body (width >= ${halvesSideBySide}px) {`,
    `  .book-frame .book-halves { flex-direction: row; overflow: hidden; }`,
    `  .book-frame .book-halves > .book-half { flex: 1 1 0; overflow-y: auto; }`,
    `  .book-frame .book-halves > .book-half-rule { display: block; }`,
    `}`,
  ].join("\n");
}

/** The media query that matches the windows that get the spread. */
export const SPREAD_QUERY = `(width >= ${SPREAD_MIN_WIDTH}px)`;

/** The cookie that keeps the form the last visit had, so the server renders that one. */
export const FORM_COOKIE = "book-form";
