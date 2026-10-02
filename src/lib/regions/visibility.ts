import { cameraTransform, type Camera, type Viewport } from "./camera";
import {
  applySimilarity,
  clipHalfPlane,
  composeSimilarity,
  invertSimilarity,
  polygonArea,
  signedDistance,
  type Polygon,
  type Similarity,
  type Vec,
} from "./geometry";
import { samplePebble } from "./pebble";
import type { Blob } from "./store";

/** Layers drawn below the frame blob. */
export const DEFAULT_DISPLAY_DEPTH = 3;

/** The frame is the deepest blob covering at least this share of the viewport. */
export const FRAME_COVERAGE = 0.5;

/** A blob narrower than this many pixels is not drawn, and neither is anything inside it. */
export const MIN_DRAW_PX = 5;

/** A blob narrower than this many pixels is not subdivided: its children would be specks. */
export const MIN_SUBDIVIDE_PX = 36;

/** Zooming in stops once the viewport, grown by this factor, fits inside a frame with nothing in view. */
export const SEALED_ZOOM_ALLOWANCE = 2;

/** Zooming out stops when the root is this share of the viewport's smaller side. */
export const MIN_ROOT_SHARE = 0.2;

/** Points per turn in the outline used to measure how much of the viewport a blob covers. */
const COVERAGE_SEGMENTS = 48;

/** Below this opacity a blob is left out. */
const MIN_ALPHA = 0.02;

export type VisibleBlob = {
  readonly blob: Blob;
  /** Maps the blob's local frame to the screen, in CSS pixels. */
  readonly toScreen: Similarity;
  /** Opacity, from the layer fade. A child is never more opaque than its parent. */
  readonly alpha: number;
  /** Whether the blob is on show but still waiting to be subdivided. */
  readonly wanted: boolean;
};

export type Scene = {
  /** The deepest blob covering at least `FRAME_COVERAGE` of the viewport; the root otherwise. */
  readonly frame: Blob;
  readonly frameToScreen: Similarity;
  /** Ancestors whose outline is off screen because they cover the whole viewport, root first. */
  readonly covering: readonly Blob[];
  /** Blobs to draw, each after its parent. */
  readonly visible: readonly VisibleBlob[];
  /** Blobs on show that should be subdivided and aren't yet, largest on screen first. */
  readonly wanted: readonly VisibleBlob[];
  /** The root's width on screen, in pixels per local unit. */
  readonly rootScale: number;
  /** Whether zooming in further would show nothing new (see `SEALED_ZOOM_ALLOWANCE`). */
  readonly zoomInBlocked: boolean;
};

type Outline = { readonly points: Polygon; readonly area: number };
const outlines = new WeakMap<Blob, Outline>();

function outlineOf(blob: Blob): Outline {
  let outline = outlines.get(blob);
  if (!outline) {
    const points = samplePebble(blob.local.core, blob.local.r, COVERAGE_SEGMENTS);
    outline = { points, area: points.length >= 3 ? polygonArea(points) : 0 };
    outlines.set(blob, outline);
  }
  return outline;
}

/** Whether the blob's bounding circle touches the viewport. */
function onScreen(blob: Blob, t: Similarity, viewport: Viewport) {
  const reach = t.s * blob.reach;
  return (
    t.x + reach > 0 && t.x - reach < viewport.width && t.y + reach > 0 && t.y - reach < viewport.height
  );
}

/** The share of the viewport's area that the blob covers, from 0 to 1. */
export function coverage(blob: Blob, toScreen: Similarity, viewport: Viewport) {
  if (!onScreen(blob, toScreen, viewport)) return 0;

  const outline = outlineOf(blob);
  const viewportArea = viewport.width * viewport.height;
  const reach = toScreen.s * blob.reach;
  const inside =
    toScreen.x - reach >= 0 &&
    toScreen.x + reach <= viewport.width &&
    toScreen.y - reach >= 0 &&
    toScreen.y + reach <= viewport.height;
  if (inside) return Math.min(1, (outline.area * toScreen.s * toScreen.s) / viewportArea);

  let clipped: Vec[] = outline.points.map((p) => applySimilarity(toScreen, p));
  clipped = clipHalfPlane(clipped, { x: -1, y: 0 }, 0);
  clipped = clipHalfPlane(clipped, { x: 1, y: 0 }, viewport.width);
  clipped = clipHalfPlane(clipped, { x: 0, y: -1 }, 0);
  clipped = clipHalfPlane(clipped, { x: 0, y: 1 }, viewport.height);
  if (clipped.length < 3) return 0;
  return Math.min(1, Math.abs(polygonArea(clipped)) / viewportArea);
}

/** Whether the screen point lies in the blob. */
export function containsPoint(blob: Blob, toScreen: Similarity, point: Vec) {
  const local = applySimilarity(invertSimilarity(toScreen), point);
  return signedDistance(blob.local.core, local) <= blob.local.r;
}

/** Whether the viewport, scaled about its centre by `grow`, lies wholly inside the blob. */
function holdsViewport(blob: Blob, toScreen: Similarity, viewport: Viewport, grow: number) {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const hw = (viewport.width / 2) * grow;
  const hh = (viewport.height / 2) * grow;
  // The blob is convex, so holding the four corners means holding everything between them.
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ].every((corner) => containsPoint(blob, toScreen, corner));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** How far a blob is toward being the frame: 0 off screen, 1 at `FRAME_COVERAGE` and beyond. */
function openness(blob: Blob, toScreen: Similarity, viewport: Viewport) {
  return clamp01(coverage(blob, toScreen, viewport) / FRAME_COVERAGE);
}

/**
 * The deepest blob covering at least `FRAME_COVERAGE` of the viewport, starting the search
 * from `start`. Siblings never overlap, so at most one blob per layer qualifies.
 */
export function findFrame(start: Blob, startToScreen: Similarity, viewport: Viewport) {
  let frame = start;
  let toScreen = startToScreen;

  while (frame.parent && frame.toParent && coverage(frame, toScreen, viewport) < FRAME_COVERAGE) {
    toScreen = composeSimilarity(toScreen, invertSimilarity(frame.toParent));
    frame = frame.parent;
  }

  for (;;) {
    let next: { blob: Blob; toScreen: Similarity } | null = null;
    for (const child of frame.children ?? []) {
      const childToScreen = composeSimilarity(toScreen, child.toParent!);
      if (coverage(child, childToScreen, viewport) >= FRAME_COVERAGE) {
        next = { blob: child, toScreen: childToScreen };
        break;
      }
    }
    if (!next) return { frame, toScreen };
    frame = next.blob;
    toScreen = next.toScreen;
  }
}

/**
 * Works out what to draw. Transforms are composed outward from the camera's anchor, up
 * through its ancestors and down into the blobs on screen, never down from the root.
 *
 * Each blob has a budget of layers it may show below itself. The root's is `displayDepth`.
 * A child's is its parent's, less the plies between them, plus its own openness, capped at
 * `displayDepth`. So the frame and everything above it keep the full budget, and the layer
 * past it fades in inside each child as that child grows toward being the frame. Opacity is
 * continuous in the camera: nothing pops when the frame changes.
 */
export function buildScene(
  anchor: Blob,
  camera: Camera,
  viewport: Viewport,
  displayDepth: number = DEFAULT_DISPLAY_DEPTH,
): Scene {
  const { frame, toScreen: frameToScreen } = findFrame(anchor, cameraTransform(camera), viewport);

  // Climb to the lowest blob that holds the whole viewport, or the root. Nothing outside it
  // can be seen, and everything above it covers the screen evenly.
  let top = frame;
  let topToScreen = frameToScreen;
  while (top.parent && top.toParent && !holdsViewport(top, topToScreen, viewport, 1)) {
    topToScreen = composeSimilarity(topToScreen, invertSimilarity(top.toParent));
    top = top.parent;
  }

  const covering: Blob[] = [];
  let rootScale = topToScreen.s;
  let above: Blob = top;
  while (above.parent && above.toParent) {
    rootScale /= above.toParent.s;
    above = above.parent;
    covering.unshift(above);
  }

  type Entry = { -readonly [K in keyof VisibleBlob]: VisibleBlob[K] };
  const visible: Entry[] = [];
  const wanted: Entry[] = [];
  let frameHasChildrenInView = false;

  function visit(blob: Blob, toScreen: Similarity, budget: number, alpha: number) {
    const entry: Entry = {
      blob,
      toScreen,
      alpha,
      wanted:
        blob.children === null &&
        blob.status === "open" &&
        budget > 0 &&
        toScreen.s >= MIN_SUBDIVIDE_PX,
    };
    visible.push(entry);
    if (entry.wanted) wanted.push(entry);

    for (const child of blob.children ?? []) {
      const childToScreen = composeSimilarity(toScreen, child.toParent!);
      if (childToScreen.s < MIN_DRAW_PX || !onScreen(child, childToScreen, viewport)) continue;

      const plies = child.depth - blob.depth;
      const shown = clamp01(budget - plies + 1);
      if (shown < MIN_ALPHA) continue;

      if (blob === frame) frameHasChildrenInView = true;
      const childBudget = Math.min(
        displayDepth,
        budget - plies + openness(child, childToScreen, viewport),
      );
      visit(child, childToScreen, childBudget, shown);
    }
  }

  // `top` is the frame or above it, so it has the full budget; so has the root from far away.
  visit(top, topToScreen, displayDepth, 1);
  wanted.sort((a, b) => b.toScreen.s - a.toScreen.s || (a.blob.id < b.blob.id ? -1 : 1));

  return {
    frame,
    frameToScreen,
    covering,
    visible,
    wanted,
    rootScale,
    zoomInBlocked:
      !frameHasChildrenInView &&
      holdsViewport(frame, frameToScreen, viewport, SEALED_ZOOM_ALLOWANCE),
  };
}

/** The deepest drawn blob under a screen point, or null when the point is on the background. */
export function hitTest(scene: Scene, point: Vec): VisibleBlob | null {
  // Each blob comes after its parent, and siblings are disjoint, so the last match is deepest.
  for (let i = scene.visible.length - 1; i >= 0; i--) {
    const entry = scene.visible[i];
    if (containsPoint(entry.blob, entry.toScreen, point)) return entry;
  }
  return null;
}
