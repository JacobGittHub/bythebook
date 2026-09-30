import { bisect, type BisectOptions, type WeightedItem } from "./bisect";
import type { Polygon, Similarity } from "./geometry";
import {
  pebbleInterior,
  shapePebble,
  toLocalFrame,
  type Pebble,
  type PebbleOptions,
} from "./pebble";
import type { Rng } from "./prng";

export type LayoutOptions = PebbleOptions &
  BisectOptions & {
    /**
     * Distance from the parent's wall to its children, in the parent's local units. It can't
     * be less than half the sibling gap, which every child keeps inside its own cell.
     */
    wallGap: number;
  };

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  siblingGap: 0.02,
  wallGap: 0.03,
  roundness: 0.15,
  jitter: (25 * Math.PI) / 180,
};

/** Points per full turn when a rounded interior is sampled into a polygon for cutting. */
export const INTERIOR_SEGMENTS = 128;

/** The root, all of chess: a disc of area 1 centred on the origin. */
export const ROOT_PEBBLE: Pebble = { core: [{ x: 0, y: 0 }], r: 1 / Math.sqrt(Math.PI) };

export type ChildGeometry = {
  /** The child's bisection cell, in the parent's local frame. */
  readonly cell: Polygon;
  /** The child's pebble, in the parent's local frame. */
  readonly pebble: Pebble;
  /** The child's pebble in its own local frame, where it has area 1. */
  readonly local: Pebble;
  /** Maps the child's local frame into the parent's. */
  readonly toParent: Similarity;
  /** The sibling gap this child kept. A thin cell keeps less than asked. */
  readonly gap: number;
};

/** How far the region for children sits inside the parent's wall. */
export function wallInset(options: LayoutOptions) {
  return Math.max(0, options.wallGap - options.siblingGap / 2);
}

/** The region a blob's children are laid out in, or null when there is no room for any. */
export function childRegion(parent: Pebble, options: LayoutOptions): Polygon | null {
  return pebbleInterior(parent, wallInset(options), INTERIOR_SEGMENTS);
}

/**
 * Lays out one blob's children. `parent` is the blob in its own local frame, so every gap is
 * relative to the parent's size and each level looks like the one above it. `rng` should
 * come from `rngFor(parentId, salt)` so the layout is stable. Returns null when the parent
 * has no room for children.
 */
export function layoutChildren(
  parent: Pebble,
  items: readonly WeightedItem[],
  rng: Rng,
  options: LayoutOptions,
): Map<string, ChildGeometry> | null {
  const region = childRegion(parent, options);
  if (!region) return null;

  const children = new Map<string, ChildGeometry>();
  for (const [id, cell] of bisect(region, items, rng, options)) {
    const { pebble, gap } = shapePebble(cell, options);
    const { local, toParent } = toLocalFrame(pebble);
    children.set(id, { cell, pebble, local, toParent, gap });
  }
  return children;
}
