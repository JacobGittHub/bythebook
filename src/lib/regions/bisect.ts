import { cutAtShare, polygonArea, principalAxis, type Polygon } from "./geometry";
import type { Rng } from "./prng";

export type WeightedItem = { readonly id: string; readonly weight: number };

export type BisectOptions = {
  /** Largest random tilt of each cut away from the region's short direction, in radians. */
  jitter: number;
};

/**
 * Below this anisotropy a region counts as round, and its cut direction is widened toward
 * fully random. A circle has no long axis, so a fixed jitter would always cut it the same way.
 */
const ROUND_REGION_ANISOTROPY = 0.15;

/** Largest item first, ties by id. Plain comparison, not locale-aware, so every machine agrees. */
function byWeightThenId(a: WeightedItem, b: WeightedItem) {
  if (a.weight !== b.weight) return b.weight - a.weight;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Splits items into two groups of roughly equal weight, adding each to the lighter group. */
function balance(items: readonly WeightedItem[]) {
  const first: WeightedItem[] = [];
  const second: WeightedItem[] = [];
  let firstWeight = 0;
  let secondWeight = 0;

  for (const item of [...items].sort(byWeightThenId)) {
    if (secondWeight < firstWeight) {
      second.push(item);
      secondWeight += item.weight;
    } else {
      first.push(item);
      firstWeight += item.weight;
    }
  }
  return { first, second, firstWeight, secondWeight };
}

/**
 * Divides a convex region into one convex cell per item, with areas proportional to the
 * weights. Each step cuts across the region's long axis (tilted at random by up to
 * `jitter`) so that the two sides hold two balanced groups of items, and randomly decides
 * which group takes which side. The same inputs and generator state give the same cells.
 */
export function bisect(
  region: Polygon,
  items: readonly WeightedItem[],
  rng: Rng,
  options: BisectOptions,
): Map<string, Polygon> {
  const ids = new Set<string>();
  for (const item of items) {
    if (!(item.weight > 0) || !Number.isFinite(item.weight)) {
      throw new RangeError(`Weight for ${item.id} must be positive and finite`);
    }
    if (ids.has(item.id)) throw new RangeError(`Duplicate id ${item.id}`);
    ids.add(item.id);
  }
  if (items.length > 0 && !(polygonArea(region) > 0)) {
    throw new RangeError("Region must have positive area");
  }

  const cells = new Map<string, Polygon>();

  function split(piece: Polygon, group: readonly WeightedItem[]) {
    if (group.length === 1) {
      cells.set(group[0].id, piece);
      return;
    }

    const { first, second, firstWeight, secondWeight } = balance(group);
    const axis = principalAxis(piece);
    const roundness = Math.max(0, 1 - axis.anisotropy / ROUND_REGION_ANISOTROPY);
    const tilt = options.jitter + (Math.PI / 2 - options.jitter) * roundness;
    const angle = axis.angle + (rng() * 2 - 1) * tilt;
    const firstOnLowSide = rng() < 0.5;

    // The cut line is perpendicular to n, so a normal along the long axis cuts across it.
    const n = { x: Math.cos(angle), y: Math.sin(angle) };
    const total = firstWeight + secondWeight;
    const lowShare = (firstOnLowSide ? firstWeight : secondWeight) / total;
    const { low, high } = cutAtShare(piece, n, lowShare);

    split(firstOnLowSide ? low : high, first);
    split(firstOnLowSide ? high : low, second);
  }

  if (items.length > 0) split(region, items);

  // Return the cells in the caller's item order.
  return new Map(items.map((item) => [item.id, cells.get(item.id)!]));
}
