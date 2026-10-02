import { describe, expect, it } from "vitest";
import {
  cameraTransform,
  centredCamera,
  frameToFrame,
  panBy,
  zoomAbout,
  type Camera,
} from "./camera";
import { applySimilarity, composeSimilarity, type Similarity } from "./geometry";
import { mulberry32, type Rng } from "./prng";
import { DEFAULT_REGION_SETTINGS, createRegionStore, type Blob } from "./store";
import { allBlobs, growStore } from "./testShapes";
import {
  DEFAULT_DISPLAY_DEPTH,
  FRAME_COVERAGE,
  MIN_DRAW_PX,
  MIN_SUBDIVIDE_PX,
  buildScene,
  containsPoint,
  coverage,
  hitTest,
  type Scene,
} from "./visibility";

const VIEWPORT = { width: 1000, height: 700 };

// Subdivided five plies deep, so a scene never runs out of blobs to show.
const store = createRegionStore();
growStore(store, 5);
const blobs = allBlobs(store);
const inner = blobs.filter((blob) => blob.children !== null);

/** A camera with `anchor` somewhere on screen, from a speck to far larger than the viewport. */
function randomCamera(rng: Rng): { anchor: Blob; camera: Camera } {
  const anchor = inner[Math.floor(rng() * inner.length)];
  return {
    anchor,
    camera: {
      anchorId: anchor.id,
      k: 60 * Math.pow(60, rng()),
      tx: VIEWPORT.width * (0.1 + 0.8 * rng()),
      ty: VIEWPORT.height * (0.1 + 0.8 * rng()),
    },
  };
}

function toScreenOf(blob: Blob, anchor: Blob, camera: Camera): Similarity {
  return composeSimilarity(cameraTransform(camera), frameToFrame(blob, anchor));
}

function isInside(blob: Blob, ancestor: Blob) {
  for (let b: Blob | null = blob; b; b = b.parent) if (b === ancestor) return true;
  return false;
}

function alphas(scene: Scene) {
  return new Map(scene.visible.map((entry) => [entry.blob, entry.alpha]));
}

describe("the frame", () => {
  it("is the root when the whole map is in view", () => {
    const camera = centredCamera(store.root.id, 2 * store.root.reach, VIEWPORT, 0.9);
    expect(buildScene(store.root, camera, VIEWPORT).frame).toBe(store.root);
  });

  it("is the deepest blob covering half the viewport, wherever the search starts", () => {
    const rng = mulberry32(31);
    for (let run = 0; run < 200; run++) {
      const { anchor, camera } = randomCamera(rng);
      const { frame, frameToScreen } = buildScene(anchor, camera, VIEWPORT);

      if (frame !== store.root) {
        expect(coverage(frame, frameToScreen, VIEWPORT)).toBeGreaterThanOrEqual(FRAME_COVERAGE);
      }
      for (const child of frame.children ?? []) {
        expect(coverage(child, toScreenOf(child, anchor, camera), VIEWPORT)).toBeLessThan(FRAME_COVERAGE);
      }
      // No blob outside the frame's line of ancestors covers half the viewport either.
      for (const blob of blobs) {
        if (isInside(frame, blob)) continue;
        expect(coverage(blob, toScreenOf(blob, anchor, camera), VIEWPORT)).toBeLessThan(FRAME_COVERAGE);
      }
    }
  });
});

describe("buildScene", () => {
  it("lists each blob after its parent, never more opaque than it, placed where the camera puts it", () => {
    const rng = mulberry32(32);
    for (let run = 0; run < 200; run++) {
      const { anchor, camera } = randomCamera(rng);
      const scene = buildScene(anchor, camera, VIEWPORT);
      const seen = new Map<Blob, number>();

      scene.visible.forEach((entry, index) => {
        if (index > 0) {
          expect(seen.has(entry.blob.parent!)).toBe(true);
          expect(entry.alpha).toBeLessThanOrEqual(seen.get(entry.blob.parent!)!);
          expect(entry.toScreen.s).toBeGreaterThanOrEqual(MIN_DRAW_PX);
        }
        expect(entry.alpha).toBeGreaterThan(0);
        seen.set(entry.blob, entry.alpha);

        const expected = toScreenOf(entry.blob, anchor, camera);
        const scale = Math.max(1, expected.s, Math.abs(expected.x), Math.abs(expected.y));
        expect(Math.abs(entry.toScreen.s - expected.s)).toBeLessThan(1e-9 * scale);
        expect(Math.abs(entry.toScreen.x - expected.x)).toBeLessThan(1e-9 * scale);
        expect(Math.abs(entry.toScreen.y - expected.y)).toBeLessThan(1e-9 * scale);
      });

      expect(seen.has(scene.frame)).toBe(true);
    }
  });

  it("starts from a blob that hides everything above it, and lists those ancestors root first", () => {
    const rng = mulberry32(33);
    for (let run = 0; run < 200; run++) {
      const { anchor, camera } = randomCamera(rng);
      const scene = buildScene(anchor, camera, VIEWPORT);
      const top = scene.visible[0].blob;

      const ancestors: Blob[] = [];
      for (let b = top.parent; b; b = b.parent) ancestors.unshift(b);
      expect(scene.covering).toEqual(ancestors);

      const corners = [
        { x: 0, y: 0 },
        { x: VIEWPORT.width, y: 0 },
        { x: VIEWPORT.width, y: VIEWPORT.height },
        { x: 0, y: VIEWPORT.height },
      ];
      if (top !== store.root) {
        for (const corner of corners) {
          expect(containsPoint(top, scene.visible[0].toScreen, corner)).toBe(true);
        }
      }

      const rootScale = toScreenOf(store.root, anchor, camera).s;
      expect(Math.abs(scene.rootScale - rootScale)).toBeLessThan(1e-9 * rootScale);
    }
  });

  it("shows every layer down to the display depth below the frame at full opacity", () => {
    const rng = mulberry32(34);
    for (let run = 0; run < 200; run++) {
      const { anchor, camera } = randomCamera(rng);
      const scene = buildScene(anchor, camera, VIEWPORT);
      const shown = alphas(scene);

      for (const entry of scene.visible) {
        const { blob } = entry;
        if (!isInside(blob, scene.frame)) continue;
        if (blob.depth <= scene.frame.depth + DEFAULT_DISPLAY_DEPTH) expect(entry.alpha).toBe(1);

        // Its children are on show too, unless too small, off screen or past the depth.
        for (const child of blob.children ?? []) {
          if (child.depth > scene.frame.depth + DEFAULT_DISPLAY_DEPTH) continue;
          const t = toScreenOf(child, anchor, camera);
          const onScreen = coverage(child, t, VIEWPORT) > 0;
          if (onScreen && t.s >= MIN_DRAW_PX * 1.001) expect(shown.has(child)).toBe(true);
        }
      }
    }
  });

  it("shows nothing below the root's children when the display depth is 1 and the map is far away", () => {
    // From far away no child covers enough of the viewport to earn a further layer.
    const camera = centredCamera(store.root.id, 2 * store.root.reach, VIEWPORT, 0.25);
    const scene = buildScene(store.root, camera, VIEWPORT, 1);
    expect(scene.visible.length).toBeGreaterThan(1);
    for (const entry of scene.visible) {
      if (entry.blob.depth > 1) expect(entry.alpha).toBeLessThan(0.2);
      expect(entry.blob.depth).toBeLessThanOrEqual(2);
    }
  });

  it("asks only for open blobs on show that are large enough, largest first", () => {
    const shallow = createRegionStore();
    growStore(shallow, 2);
    const rng = mulberry32(36);
    const parents = allBlobs(shallow).filter((blob) => blob.children !== null);

    let asked = 0;
    for (let run = 0; run < 200; run++) {
      const anchor = parents[Math.floor(rng() * parents.length)];
      const camera = { anchorId: anchor.id, k: 100 * Math.pow(30, rng()), tx: 500, ty: 350 };
      const scene = buildScene(anchor, camera, VIEWPORT);

      const visible = new Set(scene.visible);
      scene.wanted.forEach((entry, index) => {
        expect(visible.has(entry)).toBe(true);
        expect(entry.wanted).toBe(true);
        expect(entry.blob.status).toBe("open");
        expect(entry.blob.children).toBeNull();
        expect(entry.toScreen.s).toBeGreaterThanOrEqual(MIN_SUBDIVIDE_PX);
        if (index > 0) expect(entry.toScreen.s).toBeLessThanOrEqual(scene.wanted[index - 1].toScreen.s);
      });
      expect(scene.visible.filter((entry) => entry.wanted).length).toBe(scene.wanted.length);
      asked += scene.wanted.length;
    }
    expect(asked).toBeGreaterThan(0);
  });

  it("never asks for walls, leaves or an unopened Other", () => {
    const walled = createRegionStore({ ...DEFAULT_REGION_SETTINGS, maxDepth: 1 });
    growStore(walled, 3);
    const camera = centredCamera(walled.root.id, 2 * walled.root.reach, VIEWPORT, 0.9);
    const scene = buildScene(walled.root, camera, VIEWPORT);
    expect(scene.visible.length).toBeGreaterThan(1);
    expect(scene.wanted).toEqual([]);
  });
});

describe("the layer fade", () => {
  it("changes opacity only slightly for a slight move of the camera", () => {
    const rng = mulberry32(37);
    for (let run = 0; run < 300; run++) {
      const { anchor, camera } = randomCamera(rng);
      const nudged =
        run % 2 === 0
          ? zoomAbout(camera, { x: rng() * VIEWPORT.width, y: rng() * VIEWPORT.height }, 1.0004)
          : panBy(camera, rng() * 0.4 - 0.2, rng() * 0.4 - 0.2);

      const before = alphas(buildScene(anchor, camera, VIEWPORT));
      const after = alphas(buildScene(anchor, nudged, VIEWPORT));

      for (const [blob, alpha] of before) {
        const next = after.get(blob);
        if (next !== undefined) expect(Math.abs(next - alpha)).toBeLessThan(0.05);
      }
      // A blob may come or go only faintly, at the size limit, or at the screen's edge.
      for (const [from, to, view] of [
        [before, after, camera],
        [after, before, nudged],
      ] as const) {
        for (const [blob, alpha] of from) {
          if (to.has(blob) || alpha < 0.05) continue;
          const t = toScreenOf(blob, anchor, view);
          const atSizeLimit = lineage(blob).some((b) => {
            const s = toScreenOf(b, anchor, view).s;
            return Math.abs(s - MIN_DRAW_PX) < 0.01 * MIN_DRAW_PX;
          });
          const atEdge = lineage(blob).some((b) => {
            const bt = toScreenOf(b, anchor, view);
            const reach = bt.s * b.reach;
            return [bt.x + reach, VIEWPORT.width - (bt.x - reach), bt.y + reach, VIEWPORT.height - (bt.y - reach)].some(
              (gap) => Math.abs(gap) < 1,
            );
          });
          expect({ blob: blob.id, s: t.s, ok: atSizeLimit || atEdge }).toMatchObject({ ok: true });
        }
      }
    }
  });

  it("doesn't pop when a blob becomes the frame", () => {
    const rng = mulberry32(38);
    let switches = 0;
    for (let run = 0; run < 150; run++) {
      // Aim at a blob with children, and find the zoom where it crosses half the viewport.
      const target = inner[1 + Math.floor(rng() * (inner.length - 1))];
      const start: Camera = { anchorId: target.id, k: 100, tx: 500, ty: 350 };
      const centre = { x: 500, y: 350 };
      const covers = (factor: number) =>
        coverage(target, cameraTransform(zoomAbout(start, centre, factor)), VIEWPORT) >= FRAME_COVERAGE;
      if (covers(1) || !covers(40)) continue;

      let lo = 1;
      let hi = 40;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (covers(mid)) hi = mid;
        else lo = mid;
      }

      const below = buildScene(target, zoomAbout(start, centre, lo * 0.9999), VIEWPORT);
      const above = buildScene(target, zoomAbout(start, centre, hi * 1.0001), VIEWPORT);
      expect(below.frame).toBe(target.parent);
      expect(above.frame).toBe(target);
      switches++;

      const before = alphas(below);
      for (const [blob, alpha] of alphas(above)) {
        const was = before.get(blob);
        if (was !== undefined) expect(Math.abs(alpha - was)).toBeLessThan(0.02);
        else if (isInside(blob, target)) expect(alpha).toBeLessThan(0.05);
      }
    }
    expect(switches).toBeGreaterThan(50);
  });
});

/** A blob and its ancestors. */
function lineage(blob: Blob) {
  const out: Blob[] = [];
  for (let b: Blob | null = blob; b; b = b.parent) out.push(b);
  return out;
}

describe("hitTest", () => {
  it("finds the deepest drawn blob under a point", () => {
    const rng = mulberry32(39);
    let hits = 0;
    for (let run = 0; run < 100; run++) {
      const { anchor, camera } = randomCamera(rng);
      const scene = buildScene(anchor, camera, VIEWPORT);

      for (let i = 0; i < 10; i++) {
        const point = { x: rng() * VIEWPORT.width, y: rng() * VIEWPORT.height };
        const hit = hitTest(scene, point);
        const under = scene.visible.filter((entry) => containsPoint(entry.blob, entry.toScreen, point));

        if (!hit) {
          expect(under).toEqual([]);
          continue;
        }
        hits++;
        // Everything under the point is the hit blob or one of its ancestors.
        expect(under).toContain(hit);
        for (const entry of under) expect(isInside(hit.blob, entry.blob)).toBe(true);
      }
    }
    expect(hits).toBeGreaterThan(100);
  });

  it("hits a blob at its own centre", () => {
    const camera = centredCamera(store.root.id, 2 * store.root.reach, VIEWPORT, 0.9);
    const scene = buildScene(store.root, camera, VIEWPORT);
    for (const entry of scene.visible) {
      const centre = applySimilarity(entry.toScreen, { x: 0, y: 0 });
      const hit = hitTest(scene, centre)!;
      expect(isInside(hit.blob, entry.blob)).toBe(true);
    }
  });
});

describe("zoom limits", () => {
  it("lets the camera zoom in while the frame has children in view", () => {
    const camera = centredCamera(store.root.id, 2 * store.root.reach, VIEWPORT, 0.9);
    expect(buildScene(store.root, camera, VIEWPORT).zoomInBlocked).toBe(false);
  });

  it("blocks zooming in once the viewport is well inside a blob with nothing to show", () => {
    const end = blobs.find((blob) => blob.kind === "move" && blob.children === null)!;
    const centre = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
    const fitted = centredCamera(end.id, 2 * end.reach, VIEWPORT, 0.9);

    expect(buildScene(end, fitted, VIEWPORT).zoomInBlocked).toBe(false);
    const deep = buildScene(end, zoomAbout(fitted, centre, 400), VIEWPORT);
    expect(deep.frame).toBe(end);
    expect(deep.zoomInBlocked).toBe(true);
  });
});
