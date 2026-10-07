// C. Metro map: each line as a route of stations. The heaviest line runs straight along the
// middle, and each branch leaves its station for a row of its own above or below.
//
// Two routes may share a row only with clear space between them, and a route that shares a
// row is nudged a little off it, so a route ending and another starting further along can't
// read as one line (the Marshall Defense ran into a Queen's Gambit Accepted branch in the
// first mockup). The renderer also caps every route's end with a terminus bar.

import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { NAME_CHAR_W, clamp, columnWidth, type Box, type Point } from "./common";

export const METRO_PAD = { left: 18, right: 24, top: 30, bottom: 22 };
const COL_W = { min: 26, max: 72 };
const ROW_H = { min: 13, max: 26 };

/** The clear space, in columns, between two routes that share a row. */
export const METRO_ROW_GAP = 1.5;

/** How far a route that shares its row is nudged off it, as a share of the row height. */
export const METRO_NUDGE = 0.3;

export type MetroTrack = {
  /** The route's stations in order, each the parent of the next. */
  nodes: ViewNode[];
  /** The station the route branches from; null for the main line. */
  from: ViewNode | null;
  /** The row, 0 for the main line, negative above it. */
  row: number;
  /** The nudge off the row, in rows (0, or ±`METRO_NUDGE`). */
  nudge: number;
  /** The columns the route reserves in its row, its terminus label included. */
  span: [number, number];
};

export type MetroLayout = {
  width: number;
  height: number;
  colW: number;
  rowH: number;
  tracks: MetroTrack[];
  /** Each node's track index. */
  trackOf: Map<string, number>;
  points: Map<string, Point>;
};

/**
 * @param names the label written at a route's terminus, keyed by the id of the route's
 *   first station; its width is kept free in the route's row
 */
export function metroLayout(
  tree: ViewTree,
  box: Box,
  names: ReadonlyMap<string, string> = new Map(),
): MetroLayout {
  const pad = METRO_PAD;
  const colW = columnWidth(box.width - pad.left - pad.right - 80, tree.maxDepth, COL_W.min, COL_W.max);

  // Heavy paths, breadth first: a route follows the heaviest move, and every other move
  // starts a route of its own.
  const tracks: MetroTrack[] = [];
  const trackOf = new Map<string, number>();
  const queue: [ViewNode, ViewNode | null][] = [[tree.root, null]];
  while (queue.length) {
    const [start, from] = queue.shift()!;
    const track: MetroTrack = { nodes: [], from, row: 0, nudge: 0, span: [0, 0] };
    let current = start;
    for (;;) {
      track.nodes.push(current);
      trackOf.set(current.id, tracks.length);
      if (!current.children.length) break;
      for (const child of current.children.slice(1)) queue.push([child, current]);
      current = current.children[0];
    }
    const first = track.nodes[0];
    const last = track.nodes[track.nodes.length - 1];
    const label = names.get(first.id);
    const labelCols = label ? (label.length * NAME_CHAR_W + 10) / colW : 0.6;
    track.span = [from ? from.depth : 0, last.depth + labelCols];
    tracks.push(track);
  }

  // Rows: the main line takes row 0, then the biggest routes are placed first, each in the
  // nearest free row to its parent route's.
  const taken = new Map<number, [number, number][]>();
  const isFree = (row: number, [a, b]: [number, number]) =>
    !(taken.get(row) ?? []).some(([x, y]) => a < y + METRO_ROW_GAP && x < b + METRO_ROW_GAP);
  const take = (track: MetroTrack, row: number) => {
    const occupants = taken.get(row) ?? [];
    track.row = row;
    // The first route in a row sits on it; later ones alternate just below and just above.
    track.nudge = occupants.length === 0 ? 0 : occupants.length % 2 ? METRO_NUDGE : -METRO_NUDGE;
    occupants.push(track.span);
    taken.set(row, occupants);
  };
  take(tracks[0], 0);
  const order = tracks
    .map((track, index) => ({ track, index }))
    .slice(1)
    .sort(
      (p, q) =>
        q.track.nodes[0].size - p.track.nodes[0].size ||
        p.track.nodes[0].depth - q.track.nodes[0].depth ||
        p.index - q.index,
    );
  for (const { track, index } of order) {
    const parentRow = tracks[trackOf.get(track.from!.id)!].row;
    // Alternate sides, so branches spread above and below their parent route.
    const sides = index % 2 ? [-1, 1] : [1, -1];
    for (let distance = 1; ; distance++) {
      const row = sides.map((side) => parentRow + side * distance).find((r) => isFree(r, track.span));
      if (row !== undefined) {
        take(track, row);
        break;
      }
    }
  }

  const rows = tracks.map((track) => track.row);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const available = box.height - pad.top - pad.bottom;
  const rowH = clamp(available / Math.max(maxRow - minRow, 1), ROW_H.min, ROW_H.max);
  const used = rowH * (maxRow - minRow);
  const top = pad.top + Math.max(0, (available - used) / 2);

  const points = new Map<string, Point>();
  for (const track of tracks) {
    const y = top + (track.row - minRow + track.nudge) * rowH;
    for (const node of track.nodes) points.set(node.id, { x: pad.left + node.depth * colW, y });
  }
  const right = Math.max(...tracks.map((track) => track.span[1]));

  return {
    width: Math.max(box.width, pad.left + right * colW + pad.right),
    height: Math.max(box.height, top + used + pad.bottom),
    colW,
    rowH,
    tracks,
    trackOf,
    points,
  };
}
