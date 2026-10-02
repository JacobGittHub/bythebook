import type { Viewport } from "./camera";
import { inradius } from "./geometry";
import type { Blob } from "./store";
import type { Scene } from "./visibility";

/** A label is the size at which it reads best when its blob is this share of the viewport's smaller side. */
export const READING_SIZE_SHARE = 0.22;

/** Text height as a share of the room the blob has for it. */
const LABEL_FILL = 0.45;
/** Rough width of one character, as a share of the text height. */
const CHAR_WIDTH = 0.6;

/** Labels smaller than this are left out. They fade in over the next `LABEL_FADE_IN_PX`. */
export const MIN_LABEL_PX = 9;
const LABEL_FADE_IN_PX = 2;

export const LABEL_ALPHA = 0.9;
/** The opacity of the label on a blob much larger than the reading size: a watermark. */
export const WATERMARK_ALPHA = 0.16;
/** A label fades from full strength to a watermark between these multiples of the reading size. */
const WATERMARK_FROM = 1.5;
const WATERMARK_AT = 3;

/** A label taller than this share of the viewport's height can't be read, and is left out. */
const TOO_TALL_SHARE = 0.9;
const TOO_TALL_FADE_SHARE = 0.4;

/** Two labels are fully in each other's way when they share this much of the smaller one's box. */
export const FULL_OVERLAP = 0.25;
/** The difference in log size, measured from the reading size, over which two labels in each other's way trade places. */
const CROSSFADE = 0.15;

const MIN_ALPHA = 0.01;

export type Label = {
  readonly blob: Blob;
  readonly text: string;
  /** The centre of the text on screen: the centroid of the blob's core. */
  readonly x: number;
  readonly y: number;
  /** Text height in pixels. */
  readonly size: number;
  /** Rough text width in pixels. */
  readonly width: number;
  readonly alpha: number;
};

const rooms = new WeakMap<Blob, number>();

/** Half the width of the widest circle that fits in the blob, in local units. */
function roomOf(blob: Blob) {
  let room = rooms.get(blob);
  if (room === undefined) {
    room = inradius(blob.local.core) + blob.local.r;
    rooms.set(blob, room);
  }
  return room;
}

function textOf(blob: Blob) {
  if (blob.kind === "other") return "Other";
  return blob.san;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** The share of the smaller label's box that the two boxes have in common. */
export function labelOverlap(a: Label, b: Label) {
  const w = Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2);
  const h = Math.min(a.y + a.size / 2, b.y + b.size / 2) - Math.max(a.y - a.size / 2, b.y - b.size / 2);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.width * a.size, b.width * b.size);
}

/**
 * Decides which blobs are labelled, and how strongly. Every drawn blob with room gets its
 * move at its centre, sized to the blob. A blob far larger than the reading size carries its
 * label as a watermark.
 *
 * A move that most games continue with sits in the middle of its parent, so their labels
 * land on each other. Of a blob and an ancestor whose labels overlap, the one nearer the
 * reading size keeps its label and the other gives way. As the view zooms in they trade
 * places gradually, so the label at any spot is always the one at a readable size.
 */
export function placeLabels(scene: Scene, viewport: Viewport): Label[] {
  const reading = READING_SIZE_SHARE * Math.min(viewport.width, viewport.height);

  type Draft = { -readonly [K in keyof Label]: Label[K] } & { fromReading: number };
  const drafts = new Map<Blob, Draft>();

  for (const { blob, toScreen, alpha } of scene.visible) {
    const text = textOf(blob);
    if (!text) continue;

    // As tall as the blob's narrow width allows, and no wider than it.
    const room = roomOf(blob) * toScreen.s;
    const size = LABEL_FILL * Math.min(room, (3 * room) / text.length);
    if (size < MIN_LABEL_PX) continue;

    const fromReading = Math.log(toScreen.s / reading);
    const watermark = clamp01(
      (fromReading - Math.log(WATERMARK_FROM)) / (Math.log(WATERMARK_AT) - Math.log(WATERMARK_FROM)),
    );
    const strength = LABEL_ALPHA + (WATERMARK_ALPHA - LABEL_ALPHA) * watermark;
    const fadeIn = clamp01((size - MIN_LABEL_PX) / LABEL_FADE_IN_PX);
    const readable = clamp01(
      (TOO_TALL_SHARE * viewport.height - size) / (TOO_TALL_FADE_SHARE * viewport.height),
    );

    drafts.set(blob, {
      blob,
      text,
      x: toScreen.x,
      y: toScreen.y,
      size,
      width: CHAR_WIDTH * size * text.length,
      alpha: alpha * strength * fadeIn * readable,
      fromReading: Math.abs(fromReading),
    });
  }

  for (const label of drafts.values()) {
    for (let ancestor = label.blob.parent; ancestor; ancestor = ancestor.parent) {
      const above = drafts.get(ancestor);
      if (!above) continue;
      const inTheWay = clamp01(labelOverlap(label, above) / FULL_OVERLAP);
      if (inTheWay === 0) continue;

      // 1 when this label is clearly nearer the reading size, 0 when the ancestor's is.
      const keeps = clamp01(0.5 + (above.fromReading - label.fromReading) / CROSSFADE);
      label.alpha *= 1 - inTheWay * (1 - keeps);
      above.alpha *= 1 - inTheWay * keeps;
    }
  }

  const labels: Label[] = [];
  for (const { blob, text, x, y, size, width, alpha } of drafts.values()) {
    if (alpha >= MIN_ALPHA) labels.push({ blob, text, x, y, size, width, alpha });
  }
  return labels;
}
