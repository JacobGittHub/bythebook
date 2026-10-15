// The book frame's measurements and timings as CSS custom properties, made from the layout's
// and the turns' constants (layout.ts, camera.ts, turns.ts), so the CSS that draws and turns the
// book (globals.css § "The book frame", turns.css) and the code its tests check are one set of
// numbers. The frame renders this once, as a style sheet; the server render is in place before
// any script runs.

import { ZOOM_SHOWN } from "./camera";
import {
  CHAPTER_NAMES_MIN_WIDTH,
  HALF_MIN,
  PHONE,
  PHONE_MAX_WIDTH,
  SINGLE,
  SPREAD,
  SPREAD_MIN_WIDTH,
} from "./layout";
import { RIFFLE_STEP_MS, TURN_MS, ZOOM_IN_TURN_START, ZOOM_TURN_MS } from "./turns";

type Vars = Record<string, number>;

const declare = (vars: Vars) =>
  Object.entries(vars)
    .map(([name, px]) => `--${name}: ${px}px;`)
    .join(" ");

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

function singleVars(m: typeof SINGLE | typeof PHONE, column: number): Vars {
  return {
    column,
    "book-margin": m.margin,
    "slot-top": m.slots.top,
    "slot-height": m.slots.height,
    "slot-gap": m.slots.gap,
    "edge-min": m.edges.min,
    "edge-max": m.edges.max,
    "tab-out": m.edges.max + m.tabReach,
    "tab-in": m.tabIn,
    "facing-shown": m.facing.shown,
    "facing-hidden": m.facing.hidden,
    "cover-top": m.cover.top,
    "cover-bottom": m.cover.bottom,
    "cover-side": m.cover.side,
    "cover-lip": m.cover.lip,
    "half-gap": m.halfGap,
    ...pageVars(m.page),
  };
}

/**
 * The rules that narrow the one-page form's chapter column, under `frame`, to icons `width`
 * wide. Its head keeps the button that widens it, or, on a phone, which has none, the brand.
 */
function iconColumn(frame: string, width: number, phone = false): string[] {
  return [
    `${frame} { --column: ${width}px; }`,
    `${frame} :is(.book-chapter-text, .book-chapters-head > .grow) { display: none; }`,
    `${frame} ${phone ? ".book-chapters-toggle" : ".book-chapters-brand"} { display: none; }`,
    ...(phone ? [`${frame} .book-chapters-brand { display: revert; }`] : []),
    `${frame} :is(.book-chapters-head, .book-chapter, .book-chapters-foot > *) { justify-content: center; padding-inline: 0; }`,
  ];
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
    "zoom-shown": ZOOM_SHOWN,
    ...pageVars(SPREAD.page),
  };
  const halvesSideBySide = 2 * HALF_MIN + SINGLE.halfGap;

  return [
    // A turn's timing (turns.css); a turn that goes with the camera runs faster, and a zoom in's
    // turn waits for the camera (D8).
    `:root { --turn: ${TURN_MS}ms; --riffle-step: ${RIFFLE_STEP_MS}ms; }`,
    `:root[data-zoom] { --turn: ${ZOOM_TURN_MS}ms; }`,
    `:root[data-zoom="in"] { --turn-start: ${ZOOM_IN_TURN_START}ms; }`,
    `.book-frame[data-form="spread"] { ${declare(spread)} }`,
    `.book-frame[data-form="single"] { ${declare(singleVars(SINGLE, SINGLE.column.names))} }`,
    // The chapter column shows icons where the reader narrowed it (`data-chapters`) or, unless they
    // widened it, in a narrower window. On a phone it is always icons, and everything around the
    // page thins; the doubled class outranks the reader's pick.
    ...iconColumn(`.book-frame[data-form="single"][data-chapters="icons"]`, SINGLE.column.icons),
    `@media (width < ${CHAPTER_NAMES_MIN_WIDTH}px) {`,
    ...iconColumn(`.book-frame[data-form="single"]:not([data-chapters="names"])`, SINGLE.column.icons),
    `}`,
    `@media (width < ${PHONE_MAX_WIDTH}px) {`,
    `  .book-frame.book-frame[data-form="single"] { ${declare(singleVars(PHONE, PHONE.column.icons))} }`,
    ...iconColumn(`.book-frame.book-frame[data-form="single"]`, PHONE.column.icons, true),
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

/** The cookie that keeps the reader's pick of the one-page form's chapter column, names or icons. */
export const CHAPTERS_COOKIE = "book-chapters";
