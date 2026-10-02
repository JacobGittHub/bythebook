import { gameCount } from "@/lib/chess/explorerData";
import { fenAfterUci, START_FEN } from "@/lib/chess/fen";
import type { ExplorerResponse, Move } from "@/types/chess";
import type { WeightedItem } from "./bisect";
import type { Similarity } from "./geometry";
import { DEFAULT_LAYOUT_OPTIONS, ROOT_PEBBLE, layoutChildren, type LayoutOptions } from "./layout";
import { pebbleArea, type Pebble } from "./pebble";
import { rngFor } from "./prng";
import {
  DEFAULT_TOP_SETTINGS,
  selectChildren,
  type Selection,
  type TopSettings,
} from "./selection";

/** Everything that decides the map's shape. Changing any of it means a new store. */
export type RegionSettings = {
  top: TopSettings;
  layout: LayoutOptions;
  /** The Reshuffle salt: a different salt re-rolls every blob's arrangement. */
  salt: number;
  /** Blobs this many plies below the root are walls and are not subdivided. */
  maxDepth: number;
};

export const DEFAULT_MAX_DEPTH = 10;

export const DEFAULT_REGION_SETTINGS: RegionSettings = {
  top: DEFAULT_TOP_SETTINGS,
  layout: DEFAULT_LAYOUT_OPTIONS,
  salt: 0,
  maxDepth: DEFAULT_MAX_DEPTH,
};

/** The id segment of an "Other" blob. Move blobs use their UCI. */
export const OTHER_SEGMENT = "*";

export type BlobStatus =
  /** May be subdivided once its position's explorer data is given to `expand`. */
  | "open"
  /** Has children. */
  | "split"
  /** Nothing to subdivide into: no master games continue from here. */
  | "leaf"
  /** At the depth limit. */
  | "wall"
  /** An "Other" that `reveal` can open. */
  | "closed"
  /** An "Other" with nothing more to show. */
  | "sealed";

export type Blob = {
  /** The path from the root: UCI moves and "Other" segments, joined by spaces. */
  readonly id: string;
  readonly kind: "root" | "move" | "other";
  readonly parent: Blob | null;
  /**
   * Plies from the start position. An "Other" and the moves inside it have the depth of
   * the moves beside it, because "Other" is not a layer.
   */
  readonly depth: number;
  readonly uci: string | null;
  readonly san: string | null;
  /** The position after this blob's move. For an "Other", the position whose moves it holds. */
  readonly fen: string;
  /** Master games: the blob's weight among its siblings. */
  readonly games: number;
  /** The blob in its own local frame, where it has area 1. */
  readonly local: Pebble;
  /** Maps the local frame into the parent's. Null at the root. */
  readonly toParent: Similarity | null;
  /** Radius of a circle about the local origin that holds the whole blob. */
  readonly reach: number;
  /** For an "Other": the selection level whose leftovers it holds. */
  readonly level: number;
  status: BlobStatus;
  children: Blob[] | null;
};

export type RegionStore = {
  readonly settings: RegionSettings;
  readonly root: Blob;
  get(id: string): Blob | undefined;
  /** How many blobs exist. */
  size(): number;
  /** Lays out an open blob's children from its position's explorer data. */
  expand(blob: Blob, data: ExplorerResponse): void;
  /** Lays out the next tier of moves inside a closed "Other". Nothing outside it moves. */
  reveal(other: Blob): void;
};

/**
 * The blob whose position a blob shows: itself, or for an "Other" the move or root whose
 * moves it holds.
 */
export function positionBlob(blob: Blob): Blob {
  let owner = blob;
  while (owner.kind === "other" && owner.parent) owner = owner.parent;
  return owner;
}

/** The moves that reach a blob's position from the start, in order. "Other" is not a move. */
export function lineTo(blob: Blob): Move[] {
  const line: Move[] = [];
  for (let b: Blob | null = positionBlob(blob); b; b = b.parent) {
    if (b.kind === "move") line.unshift({ san: b.san!, uci: b.uci!, fen: b.fen });
  }
  return line;
}

function reachOf(pebble: Pebble) {
  let far = 0;
  for (const v of pebble.core) far = Math.max(far, Math.hypot(v.x, v.y));
  return far + pebble.r;
}

/**
 * The blob tree the region map draws. It starts as the root alone and grows as the view
 * hands it explorer data. The same settings and data always give the same geometry, in
 * whatever order blobs are expanded, because each blob's layout is seeded by its own id.
 */
export function createRegionStore(settings: RegionSettings = DEFAULT_REGION_SETTINGS): RegionStore {
  const root: Blob = {
    id: "",
    kind: "root",
    parent: null,
    depth: 0,
    uci: null,
    san: null,
    fen: START_FEN,
    games: 0,
    local: ROOT_PEBBLE,
    toParent: null,
    reach: reachOf(ROOT_PEBBLE),
    level: 0,
    status: settings.maxDepth > 0 ? "open" : "wall",
    children: null,
  };

  const byId = new Map<string, Blob>([[root.id, root]]);
  /** What each expanded position showed, kept so its "Other" can open later. */
  const expanded = new Map<Blob, { data: ExplorerResponse; openLevels: number }>();

  /**
   * Lays out one selection level inside `container`: the level's moves, plus an "Other" for
   * what they leave over. `owner` is the blob whose position the moves are played from.
   */
  function buildLevel(container: Blob, owner: Blob, selection: Selection, level: number) {
    const { moves, otherGames } = selection.levels[level];
    const depth = owner.depth + 1;

    const fens = new Map<string, string>();
    const items: WeightedItem[] = [];
    for (const move of moves) {
      const fen = fenAfterUci(owner.fen, move.uci);
      if (!fen) continue;
      fens.set(move.uci, fen);
      items.push({ id: move.uci, weight: gameCount(move) });
    }
    if (otherGames > 0) items.push({ id: OTHER_SEGMENT, weight: otherGames });

    const cells =
      items.length > 0
        ? layoutChildren(container.local, items, rngFor(container.id, settings.salt), settings.layout)
        : null;
    if (!cells) {
      container.status = container.kind === "other" ? "sealed" : "leaf";
      return;
    }

    const children: Blob[] = [];
    const add = (segment: string, fields: Pick<Blob, "kind" | "uci" | "san" | "fen" | "games" | "level" | "status">) => {
      const geometry = cells.get(segment)!;
      // A cell too thin to hold a pebble has no frame of its own to draw in.
      if (!(pebbleArea(geometry.pebble) > 0) || !Number.isFinite(1 / geometry.toParent.s)) return null;

      const blob: Blob = {
        id: container.id ? `${container.id} ${segment}` : segment,
        parent: container,
        depth,
        local: geometry.local,
        toParent: geometry.toParent,
        reach: reachOf(geometry.local),
        children: null,
        ...fields,
      };
      byId.set(blob.id, blob);
      children.push(blob);
      return blob;
    };

    for (const move of moves) {
      const fen = fens.get(move.uci);
      if (!fen) continue;
      add(move.uci, {
        kind: "move",
        uci: move.uci,
        san: move.san,
        fen,
        games: gameCount(move),
        level,
        status: depth >= settings.maxDepth ? "wall" : "open",
      });
    }

    if (otherGames > 0) {
      const isLastLevel = level === selection.levels.length - 1;
      const other = add(OTHER_SEGMENT, {
        kind: "other",
        uci: null,
        san: null,
        fen: owner.fen,
        games: otherGames,
        level,
        status: isLastLevel && !selection.canOpenOther ? "sealed" : "closed",
      });
      if (other && !isLastLevel) buildLevel(other, owner, selection, level + 1);
    }

    container.children = children;
    container.status = "split";
  }

  return {
    settings,
    root,
    get: (id) => byId.get(id),
    size: () => byId.size,

    expand(blob, data) {
      if (blob.status !== "open" || blob.kind === "other") return;

      const openLevels = 1;
      const selection = selectChildren(data.moves, data.totals, openLevels, settings.top);
      if (selection.levels[0].moves.length === 0) {
        blob.status = "leaf";
        return;
      }
      expanded.set(blob, { data, openLevels });
      buildLevel(blob, blob, selection, 0);
    },

    reveal(other) {
      if (other.kind !== "other" || other.status !== "closed") return;
      const owner = positionBlob(other);
      const shown = expanded.get(owner);
      if (!shown) return;

      shown.openLevels = other.level + 2;
      const { data } = shown;
      const selection = selectChildren(data.moves, data.totals, shown.openLevels, settings.top);
      if (selection.levels.length <= other.level + 1) {
        other.status = "sealed";
        return;
      }
      buildLevel(other, owner, selection, other.level + 1);
    },
  };
}
