import { describe, expect, it } from "vitest";
import { START_FEN, fenAfterUci } from "@/lib/chess/fen";
import { applySimilarity, signedDistance } from "./geometry";
import { pebbleArea, samplePebble } from "./pebble";
import { DEFAULT_TOP_SETTINGS, TIER_COUNT, selectChildren } from "./selection";
import {
  DEFAULT_REGION_SETTINGS,
  OTHER_SEGMENT,
  createRegionStore,
  lineTo,
  positionBlob,
  type Blob,
  type RegionStore,
} from "./store";
import { allBlobs, fakeExplorerData, growStore } from "./testShapes";

/** The geometry of every blob, by id. */
function geometryOf(store: RegionStore) {
  return new Map(allBlobs(store).map((b) => [b.id, { local: b.local, toParent: b.toParent }]));
}

function otherIn(blob: Blob) {
  return blob.children?.find((child) => child.kind === "other");
}

describe("createRegionStore", () => {
  it("starts as the root alone: the start position, open, with no children", () => {
    const store = createRegionStore();
    expect(store.size()).toBe(1);
    expect(store.get("")).toBe(store.root);
    expect(store.root).toMatchObject({
      kind: "root",
      depth: 0,
      fen: START_FEN,
      status: "open",
      children: null,
      toParent: null,
    });
    expect(pebbleArea(store.root.local)).toBeCloseTo(1, 12);
  });
});

describe("expand", () => {
  it("gives a blob the selected moves, and an Other holding the games they leave", () => {
    const store = createRegionStore();
    const data = fakeExplorerData(START_FEN);
    store.expand(store.root, data);

    const selection = selectChildren(data.moves, data.totals, 1, DEFAULT_TOP_SETTINGS);
    const moves = store.root.children!.filter((child) => child.kind === "move");
    expect(moves.map((m) => m.uci).sort()).toEqual(selection.levels[0].moves.map((m) => m.uci).sort());
    expect(store.root.status).toBe("split");

    const other = otherIn(store.root)!;
    expect(other.id).toBe(OTHER_SEGMENT);
    expect(other.games).toBe(selection.levels[0].otherGames);
    expect(other.fen).toBe(START_FEN);
    expect(other.status).toBe("closed");
    expect(moves.reduce((sum, m) => sum + m.games, 0) + other.games).toBe(selection.total);
  });

  it("names each blob by its path, and finds it by that name", () => {
    const store = createRegionStore();
    growStore(store, 3);
    const blobs = allBlobs(store);
    expect(new Set(blobs.map((b) => b.id)).size).toBe(blobs.length);
    expect(store.size()).toBe(blobs.length);

    for (const blob of blobs) {
      expect(store.get(blob.id)).toBe(blob);
      if (!blob.parent) continue;
      const segment = blob.kind === "other" ? OTHER_SEGMENT : blob.uci;
      expect(blob.id).toBe(blob.parent.id ? `${blob.parent.id} ${segment}` : segment);
    }
  });

  it("puts every blob inside its parent, in a local frame of area 1", () => {
    const store = createRegionStore();
    growStore(store, 3);

    for (const blob of allBlobs(store)) {
      expect(pebbleArea(blob.local)).toBeCloseTo(1, 9);
      if (!blob.parent || !blob.toParent) continue;

      for (const p of samplePebble(blob.local.core, blob.local.r, 24)) {
        const inParent = applySimilarity(blob.toParent, p);
        expect(signedDistance(blob.parent.local.core, inParent)).toBeLessThan(blob.parent.local.r);
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(blob.reach + 1e-12);
      }
    }
  });

  it("counts plies from the root, and gives each move blob the position after its move", () => {
    const store = createRegionStore();
    growStore(store, 3);

    for (const blob of allBlobs(store)) {
      if (blob.kind !== "move") continue;
      const moves = blob.id.split(" ").filter((segment) => segment !== OTHER_SEGMENT);
      expect(blob.depth).toBe(moves.length);
      expect(blob.fen.split(" ")[1]).toBe(blob.depth % 2 === 1 ? "b" : "w");
    }
  });

  it("gives the same geometry whatever order blobs are expanded in", () => {
    const forward = createRegionStore();
    growStore(forward, 3);

    const backward = createRegionStore();
    for (let round = 0; round < 4; round++) {
      for (const blob of allBlobs(backward).reverse()) {
        if (blob.status === "open" && blob.depth < 3) backward.expand(blob, fakeExplorerData(blob.fen));
      }
    }

    expect(geometryOf(backward)).toEqual(geometryOf(forward));
  });

  it("gives a different arrangement for a different salt", () => {
    const a = createRegionStore();
    const b = createRegionStore({ ...DEFAULT_REGION_SETTINGS, salt: 1 });
    const data = fakeExplorerData(START_FEN);
    a.expand(a.root, data);
    b.expand(b.root, data);

    expect(b.root.children!.map((c) => c.id)).toEqual(a.root.children!.map((c) => c.id));
    const moved = a.root.children!.some((child) => {
      const ta = child.toParent!;
      const tb = b.get(child.id)!.toParent!;
      return Math.hypot(ta.x - tb.x, ta.y - tb.y) > 0.01;
    });
    expect(moved).toBe(true);
  });

  it("turns blobs at the depth limit into walls, and leaves them alone", () => {
    const store = createRegionStore({ ...DEFAULT_REGION_SETTINGS, maxDepth: 2 });
    growStore(store, 5);

    const moves = allBlobs(store).filter((b) => b.kind === "move");
    expect(Math.max(...moves.map((b) => b.depth))).toBe(2);
    for (const blob of moves) {
      expect(blob.status).toBe(blob.depth === 2 ? "wall" : "split");
    }

    const wall = moves.find((b) => b.status === "wall")!;
    store.expand(wall, fakeExplorerData(wall.fen));
    expect(wall.children).toBeNull();
    expect(wall.status).toBe("wall");
  });

  it("marks a position no game continues from as a leaf", () => {
    const store = createRegionStore();
    store.expand(store.root, { moves: [], totals: { white: 3, draws: 1, black: 2 } });
    expect(store.root.status).toBe("leaf");
    expect(store.root.children).toBeNull();
  });
});

describe("reveal", () => {
  it("lays out the next tier inside Other and moves nothing else", () => {
    const store = createRegionStore();
    growStore(store, 2);
    const before = geometryOf(store);
    const sizeBefore = store.size();

    const other = otherIn(store.root)!;
    store.reveal(other);

    expect(other.status).toBe("split");
    expect(store.size()).toBeGreaterThan(sizeBefore);
    for (const [id, geometry] of before) {
      const now = store.get(id)!;
      expect(now.local).toBe(geometry.local);
      expect(now.toParent).toBe(geometry.toParent);
    }
  });

  it("shows moves the tier above left out, at the same depth as the moves beside Other", () => {
    const store = createRegionStore();
    const data = fakeExplorerData(START_FEN);
    store.expand(store.root, data);
    const other = otherIn(store.root)!;
    store.reveal(other);

    const selection = selectChildren(data.moves, data.totals, 2, DEFAULT_TOP_SETTINGS);
    const inside = other.children!.filter((child) => child.kind === "move");
    expect(inside.map((m) => m.uci).sort()).toEqual(selection.levels[1].moves.map((m) => m.uci).sort());

    const beside = new Set(store.root.children!.map((child) => child.uci));
    for (const blob of inside) {
      expect(beside.has(blob.uci)).toBe(false);
      expect(blob.depth).toBe(other.depth);
      expect(blob.id).toBe(`${OTHER_SEGMENT} ${blob.uci}`);
      expect(blob.status).toBe("open");
    }
  });

  it("can be opened once per tier, and the last Other is sealed", () => {
    const store = createRegionStore();
    // Games in moves the explorer doesn't list, so something is left over after every tier.
    const data = fakeExplorerData(START_FEN);
    const totals = { ...data.totals!, white: data.totals!.white + 5000 };
    store.expand(store.root, { ...data, totals });

    let other = otherIn(store.root)!;
    for (let tier = 2; tier <= TIER_COUNT; tier++) {
      expect(other.status).toBe("closed");
      store.reveal(other);
      expect(other.status).toBe("split");
      other = otherIn(other)!;
    }

    expect(other.status).toBe("sealed");
    store.reveal(other);
    expect(other.children).toBeNull();
    expect(other.status).toBe("sealed");
  });

  it("subdivides a move found inside Other like any other move", () => {
    const store = createRegionStore();
    store.expand(store.root, fakeExplorerData(START_FEN));
    const other = otherIn(store.root)!;
    store.reveal(other);

    const move = other.children!.find((child) => child.kind === "move")!;
    store.expand(move, fakeExplorerData(move.fen));
    expect(move.status).toBe("split");
    expect(move.children!.every((child) => child.depth === move.depth + 1)).toBe(true);
  });
});

describe("lineTo", () => {
  const store = createRegionStore();
  growStore(store, 3);
  for (const blob of allBlobs(store)) {
    if (blob.kind === "other" && blob.status === "closed") store.reveal(blob);
  }
  growStore(store, 3);

  it("is empty at the root, and replays to every blob's position", () => {
    expect(lineTo(store.root)).toEqual([]);

    for (const blob of allBlobs(store)) {
      const line = lineTo(blob);
      expect(line.length).toBe(blob.kind === "other" ? blob.depth - 1 : blob.depth);

      let fen: string | null = START_FEN;
      for (const move of line) {
        fen = fenAfterUci(fen!, move.uci);
        expect(move.fen).toBe(fen);
      }
      expect(fen).toBe(blob.fen);
    }
  });

  it("gives an Other, and a move inside one, the line of the position they belong to", () => {
    const others = allBlobs(store).filter((blob) => blob.kind === "other");
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) {
      const owner = positionBlob(other);
      expect(owner.kind).not.toBe("other");
      expect(owner.fen).toBe(other.fen);
      expect(lineTo(other)).toEqual(lineTo(owner));

      for (const inside of other.children ?? []) {
        if (inside.kind !== "move") continue;
        expect(positionBlob(inside)).toBe(inside);
        expect(lineTo(inside).map((move) => move.uci)).toEqual([
          ...lineTo(owner).map((move) => move.uci),
          inside.uci,
        ]);
      }
    }
  });
});
