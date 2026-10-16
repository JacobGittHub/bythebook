// How the book turns from one page to another (plans/book-ui.md D4, D8, D13): which way, which
// leaves riffle past on the way, how the camera moves with a second level, and when each runs.
// The turn itself is CSS (src/components/book/turns.css), timed by these constants (frameCss.ts).

import type { Level } from "./chapters";
import { PAGE_BORDER, type BookForm, type BookmarkPlace } from "./layout";

/** How long a page turn takes (D13), and how long one takes when the camera moves with it (D8). */
export const TURN_MS = 450;
export const ZOOM_TURN_MS = 400;
/** Each riffled leaf turns this long after the one before, and the turn's last page waits for them. */
export const RIFFLE_STEP_MS = 70;
/** How long the camera takes to zoom in on a second level or out of one (D8), and its easing. */
export const ZOOM_MS = 375;
export const ZOOM_EASING = "cubic-bezier(0.5, 0.05, 0.2, 1)";
/** How far into the first of a turn and a zoom the second starts (D8). */
export const ZOOM_OVERLAP = 0.45;
/** When a zoom out's turn starts; turns.css delays the turn by it. */
export const ZOOM_OUT_TURN_START = ZOOM_OVERLAP * ZOOM_MS;

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

/** A place in the book: a chapter, from 0 in book order, and the level within it. */
export type Place = { at: number; level: Level };

/** How the camera moves with a turn (D8): in to a second level, out of one, or across between two in different chapters. */
export type Zoom = "in" | "out" | "across";

export type Move = Turn & { zoom: Zoom | null };

/**
 * The move from `from` to `to`, or null when the page changes without turning. A second level
 * lies after its chapter's own page, so going down a level turns forward and coming up turns
 * back; another page of the same second level, such as another Library book, doesn't turn
 * (D13). The camera moves only in the spread: the one-page form has no zoom (D15).
 */
export function moveBetween(from: Place, to: Place, form: BookForm): Move | null {
  const turn =
    from.at !== to.at
      ? turnBetween(from.at, to.at)
      : from.at >= 0 && from.level !== to.level
        ? { way: to.level > from.level ? ("forward" as const) : ("back" as const), riffled: [] }
        : null;
  if (!turn) return null;
  let zoom: Zoom | null = null;
  if (form === "spread") {
    if (from.level < to.level) zoom = "in";
    else if (from.level > to.level) zoom = "out";
    else if (from.level === 2) zoom = "across";
  }
  return { ...turn, zoom };
}

/** When a move's turn and its camera run, in milliseconds from the move's start. */
export type MoveTiming = {
  /** How long the turn of one leaf takes. */
  turn: number;
  turnStart: number;
  /** When the turn's last leaf lies down, its riffles included. */
  turnEnd: number;
  zoomStart: number;
  zoomEnd: number;
};

/**
 * When a move's turn and camera run (D8). Zooming in, the turn goes first, so the whole new page
 * shows before the camera moves in, and the camera starts `ZOOM_OVERLAP` of the way into it;
 * zooming out, the camera goes first and the turn starts that far into it; across, they run
 * together. A move without a zoom has none.
 */
export function moveTiming(move: Move): MoveTiming {
  const turn = move.zoom ? ZOOM_TURN_MS : TURN_MS;
  const turnLength = turn + move.riffled.length * RIFFLE_STEP_MS;
  const timing = (turnStart: number, zoomStart: number, zoomLength: number): MoveTiming => ({
    turn,
    turnStart,
    turnEnd: turnStart + turnLength,
    zoomStart,
    zoomEnd: zoomStart + zoomLength,
  });
  switch (move.zoom) {
    case "in":
      return timing(0, ZOOM_OVERLAP * turnLength, ZOOM_MS);
    case "out":
      return timing(ZOOM_OUT_TURN_START, 0, ZOOM_MS);
    case "across":
      return timing(0, 0, turnLength);
    default:
      return timing(0, 0, 0);
  }
}
