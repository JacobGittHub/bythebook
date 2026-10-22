// Walking a book view and the camera that follows (plans/game-history.md D32 as amended). The
// selected position is the current one; Up and Down move a highlight among its moves, Right goes
// to the highlighted move and Left back to the parent. The camera pans and zooms to keep the
// current position and its moves in frame, and eases there. Pure, so the rules are tested in
// Node; `BookView` reads the keys and moves the drawing.

import type { ViewNode } from "@/lib/books/viewTree";
import type { Box, Point } from "./common";
import { MIN_ZOOM, clampZoom } from "./zoom";

/** How long the camera takes to move to a new frame. */
export const CAMERA_EASE_MS = 250;

/** The camera zooms in on its own no further than this; the user may go further. */
export const AUTO_MAX_ZOOM = 2;

/** Where the current position sits across the view, from its left edge. */
const LEAD = 0.3;
/** How near an edge, as a share of the view, the moves may come before the camera re-centres them. */
const EDGE = 0.18;
/** The share of the view the current position and its moves may fill before the camera zooms out. */
const ROOM = 0.7;

/** Which of a position's moves is highlighted: `index` among the children of the position `forId`. */
export type Walk = { forId: string; index: number };

/** The highlighted move's index: the walk's, while it is for this position, else the most played (0). */
export function highlightIndex(node: ViewNode, walk: Walk | null): number {
  if (!node.children.length) return -1;
  return walk && walk.forId === node.id ? Math.min(Math.max(walk.index, 0), node.children.length - 1) : 0;
}

/**
 * What an arrow key does at `node`: a new highlight, or a position to go to with the highlight it
 * starts with there. Left starts on the move it came back from. Up and Down stop at the first and
 * last move. Null for any other key.
 */
export function walkKey(key: string, node: ViewNode, walk: Walk | null): { walk: Walk; go: ViewNode | null } | null {
  const index = highlightIndex(node, walk);
  const last = node.children.length - 1;
  switch (key) {
    case "ArrowUp":
      return { walk: { forId: node.id, index: Math.max(0, index - 1) }, go: null };
    case "ArrowDown":
      return { walk: { forId: node.id, index: Math.min(last, index + 1) }, go: null };
    case "ArrowRight": {
      const next = node.children[index];
      return next ? { walk: { forId: next.id, index: 0 }, go: next } : { walk: { forId: node.id, index }, go: null };
    }
    case "ArrowLeft": {
      const parent = node.parent;
      return parent
        ? { walk: { forId: parent.id, index: parent.children.indexOf(node) }, go: parent }
        : { walk: { forId: node.id, index }, go: null };
    }
    default:
      return null;
  }
}

/** The camera: its zoom, and the drawing's point at the centre of the view, in drawing units. */
export type Camera = { zoom: number; x: number; y: number };

/** The camera a scroll position shows. */
export function cameraAt(scroll: { left: number; top: number }, zoom: number, view: Box): Camera {
  return { zoom, x: (scroll.left + view.width / 2) / zoom, y: (scroll.top + view.height / 2) / zoom };
}

/** The scroll position that shows `camera`. */
export function scrollFor(camera: Camera, view: Box): { left: number; top: number } {
  return { left: camera.x * camera.zoom - view.width / 2, top: camera.y * camera.zoom - view.height / 2 };
}

/** Keeps the view on the drawing: a drawing smaller than the view sits at its top left, as it scrolls. */
function clampCamera(camera: Camera, view: Box, drawing: Box): Camera {
  const along = (centre: number, viewSize: number, drawingSize: number) => {
    const half = viewSize / 2 / camera.zoom;
    return drawingSize - half <= half ? half : Math.min(drawingSize - half, Math.max(half, centre));
  };
  return { zoom: camera.zoom, x: along(camera.x, view.width, drawing.width), y: along(camera.y, view.height, drawing.height) };
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function boundsOf(points: readonly Point[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

export type FrameInput = {
  camera: Camera;
  /** The view's size on screen. */
  view: Box;
  /** The drawing's size at zoom 1. */
  drawing: Box;
  /** The current position. */
  current: Point;
  /** Its moves, in order. */
  moves: readonly Point[];
  /** The highlighted move, kept in view when the moves don't all fit. */
  highlight: Point | null;
  /** Whether the camera may zoom as well as pan. */
  zoom: boolean;
};

/**
 * The camera that frames the current position and its moves. Zooming, it goes out when they
 * don't fit and in when they would sit small, never in past `AUTO_MAX_ZOOM`. It puts the current
 * position `LEAD` across the view, and re-centres the moves up and down as soon as they come
 * within `EDGE` of the view's top or bottom.
 */
export function frameCamera({ camera, view, drawing, current, moves, highlight, zoom: mayZoom }: FrameInput): Camera {
  const around = boundsOf([current, ...moves]);
  let zoom = camera.zoom;
  if (mayZoom && moves.length) {
    const spanX = around.maxX - around.minX;
    const spanY = around.maxY - around.minY;
    // The screen share the moves take per unit of zoom.
    const need = Math.max(spanX / (view.width * ROOM), spanY / (view.height * ROOM));
    let next = zoom;
    if (need === 0) next = Math.max(zoom, 1);
    else if (zoom * need > 1) next = 1 / need;
    else if (zoom * need < 0.3 && zoom < AUTO_MAX_ZOOM) next = Math.min(AUTO_MAX_ZOOM, 0.6 / need);
    next = clampZoom(Math.max(next, MIN_ZOOM));
    // Small changes aren't worth a move.
    if (Math.abs(next - zoom) / zoom > 0.04) zoom = next;
  }

  // The moves stay in frame if they fit, else the highlighted one with the current position, else it alone.
  const fits = (bounds: Bounds) => (bounds.maxY - bounds.minY) * zoom <= view.height * (1 - 2 * EDGE);
  let kept = around;
  if (!fits(around) && highlight) {
    const withCurrent = boundsOf([current, highlight]);
    kept = fits(withCurrent) ? withCurrent : boundsOf([highlight]);
  }
  const x = current.x + (0.5 - LEAD) * (view.width / zoom);
  const halfH = view.height / 2 / zoom;
  const edge = (EDGE * view.height) / zoom;
  let y = camera.y;
  if (kept.minY < y - halfH + edge || kept.maxY > y + halfH - edge) y = (kept.minY + kept.maxY) / 2;
  return clampCamera({ zoom, x, y }, view, drawing);
}

/** Eases in and out, so a move starts and ends gently. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The camera `t` of the way (0 to 1) from `from` to `to`: the centre moves evenly and the zoom
 * by equal ratios, so a zoom feels the same speed in and out.
 */
export function easeCamera(from: Camera, to: Camera, t: number): Camera {
  const u = ease(Math.min(1, Math.max(0, t)));
  return {
    zoom: from.zoom * (to.zoom / from.zoom) ** u,
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u,
  };
}
