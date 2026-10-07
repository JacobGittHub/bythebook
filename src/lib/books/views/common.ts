// What the book view layouts share. Each layout is a pure function of a view tree, the box
// it is drawn in and its own options; none of them reads what the pointer is over, so
// hovering never moves anything (the jitter the first spine mockup had).

/** The drawing area a layout fills, in CSS pixels. */
export type Box = { width: number; height: number };

export type Point = { x: number; y: number };

/** Width of one character of the views' monospace labels (9.5px JetBrains Mono or Geist Mono). */
export const LABEL_CHAR_W = 5.8;

/** Width of one character of a line's name at its terminus (10.5px sans). */
export const NAME_CHAR_W = 5.6;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Space between columns: as much as the box allows, between the two limits. */
export function columnWidth(available: number, columns: number, min: number, max: number): number {
  return clamp(available / Math.max(columns, 1), min, max);
}
