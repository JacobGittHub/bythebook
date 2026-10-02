// Canvas 2D drawing for the region map. Everything is drawn in CSS pixels; the caller scales
// the context for the device's pixel ratio.
import type { Viewport } from "@/lib/regions/camera";
import type { Similarity } from "@/lib/regions/geometry";
import { placeLabels } from "@/lib/regions/labels";
import { pebbleArcs, type Arc } from "@/lib/regions/pebble";
import type { Blob } from "@/lib/regions/store";
import type { Scene } from "@/lib/regions/visibility";

export type RenderOptions = {
  showLabels: boolean;
  /** The time in milliseconds, which moves the dots along the outline of a blob that is loading. */
  now: number;
};

type Rgb = readonly [number, number, number];

/** A neutral mid tone, so both white and black edges read against it. */
const BACKGROUND: Rgb = [134, 131, 126];

// Edge colours by the side that made the move, each mixed with the popularity tint
// (cream for White's moves, brown for Black's).
const WHITE_EDGE: Rgb = [247, 240, 226];
const BLACK_EDGE: Rgb = [30, 22, 14];
const ROOT_EDGE: Rgb = [58, 55, 51];

// Strong enough that a White move's blob and a Black move's read as light and dark at a
// glance. Each layer is filled over the one above it, so the map checkers as it nests.
const WHITE_FILL_ALPHA = 0.2;
const BLACK_FILL_ALPHA = 0.24;

/** Stroke width in pixels by layers below the frame: heaviest at the frame and above. */
const STROKE_BY_LAYER = [3, 2.25, 1.5, 1];
/** A stroke is at most this share of its blob's width, so small blobs stay open. */
const MAX_STROKE_SHARE = 0.04;

const OTHER_DASH = [7, 5];
const WAITING_DASH = [1, 5];
/** How fast the dots travel round a blob that is loading, in pixels a second. */
const WAITING_DOT_SPEED = 14;

const HATCH_SPACING_PX = 9;
const HATCH_ALPHA = 0.3;

const LABEL_FONT = "ui-sans-serif, system-ui, sans-serif";

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function edgeColor(blob: Blob): Rgb {
  if (blob.kind === "root") return ROOT_EDGE;
  // Odd plies are White's moves.
  return blob.depth % 2 === 1 ? WHITE_EDGE : BLACK_EDGE;
}

function fillAlpha(blob: Blob) {
  if (blob.kind === "root") return 0;
  // The moves inside an opened "Other" carry the fill, as the moves beside it do. Filling
  // both would tint them twice.
  if (blob.kind === "other" && blob.children) return 0;
  return blob.depth % 2 === 1 ? WHITE_FILL_ALPHA : BLACK_FILL_ALPHA;
}

const arcsByBlob = new WeakMap<Blob, Arc[]>();

function arcsOf(blob: Blob) {
  let arcs = arcsByBlob.get(blob);
  if (!arcs) {
    arcs = pebbleArcs(blob.local.core);
    arcsByBlob.set(blob, arcs);
  }
  return arcs;
}

/** Traces the blob's outline: its corner arcs, which the canvas joins with straight edges. */
function tracePebble(ctx: CanvasRenderingContext2D, blob: Blob, t: Similarity) {
  const radius = t.s * blob.local.r;
  ctx.beginPath();
  for (const arc of arcsOf(blob)) {
    ctx.arc(t.s * arc.x + t.x, t.s * arc.y + t.y, radius, arc.start, arc.end);
  }
  ctx.closePath();
}

/**
 * Diagonal lines across the blob whose outline is the current path, clipped to it and fixed
 * to it as it moves. The hatch lines become the current path.
 */
function hatch(ctx: CanvasRenderingContext2D, blob: Blob, t: Similarity, viewport: Viewport, color: Rgb) {
  const reach = t.s * blob.reach;
  const left = Math.max(0, t.x - reach);
  const right = Math.min(viewport.width, t.x + reach);
  const top = Math.max(0, t.y - reach);
  const bottom = Math.min(viewport.height, t.y + reach);
  if (left >= right || top >= bottom) return;

  ctx.save();
  ctx.clip();
  ctx.beginPath();
  // Each line is x + y = c. Start from the blob's centre so the lines travel with it.
  const step = HATCH_SPACING_PX * Math.SQRT2;
  const origin = t.x + t.y;
  const first = origin + Math.ceil((left + top - origin) / step) * step;
  for (let c = first; c <= right + bottom; c += step) {
    ctx.moveTo(c - top, top);
    ctx.lineTo(c - bottom, bottom);
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(color, HATCH_ALPHA);
  ctx.stroke();
  ctx.restore();
}

/** Draws one frame of the map. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: Viewport,
  options: RenderOptions,
) {
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(BACKGROUND, 1);
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Blobs that cover the whole screen still tint it, so the tone doesn't jump when an
  // outline leaves the view.
  for (const blob of scene.covering) {
    const alpha = fillAlpha(blob);
    if (alpha === 0) continue;
    ctx.fillStyle = rgba(edgeColor(blob), alpha);
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  ctx.lineJoin = "round";
  const period = WAITING_DASH[0] + WAITING_DASH[1];
  const waitingOffset = ((options.now / 1000) * WAITING_DOT_SPEED) % period;

  for (const entry of scene.visible) {
    const { blob, toScreen: t } = entry;
    const color = edgeColor(blob);
    ctx.globalAlpha = entry.alpha;
    tracePebble(ctx, blob, t);

    const fill = fillAlpha(blob);
    if (fill > 0) {
      ctx.fillStyle = rgba(color, fill);
      ctx.fill();
    }
    if (blob.status === "wall") {
      hatch(ctx, blob, t, viewport, color);
      // The hatching replaced the current path.
      tracePebble(ctx, blob, t);
    }

    const layer = Math.min(STROKE_BY_LAYER.length - 1, Math.max(0, blob.depth - scene.frame.depth));
    ctx.lineWidth = Math.min(STROKE_BY_LAYER[layer], Math.max(0.5, MAX_STROKE_SHARE * t.s));
    ctx.strokeStyle = rgba(color, 1);
    if (blob.kind === "other") {
      ctx.setLineDash(OTHER_DASH);
      ctx.lineCap = "butt";
    } else if (entry.wanted) {
      ctx.setLineDash(WAITING_DASH);
      ctx.lineCap = "round";
      ctx.lineDashOffset = -waitingOffset;
    } else {
      ctx.setLineDash([]);
      ctx.lineCap = "butt";
    }
    ctx.stroke();
    ctx.lineDashOffset = 0;
  }

  // Labels go on last, over every outline.
  if (options.showLabels) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of placeLabels(scene, viewport)) {
      ctx.globalAlpha = label.alpha;
      ctx.font = `600 ${label.size}px ${LABEL_FONT}`;
      ctx.fillStyle = rgba(edgeColor(label.blob), 1);
      ctx.fillText(label.text, label.x, label.y);
    }
  }

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}
