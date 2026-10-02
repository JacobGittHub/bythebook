import { describe, expect, it } from "vitest";
import {
  cameraTransform,
  centredCamera,
  frameToFrame,
  panBy,
  reanchor,
  screenToAnchor,
  zoomAbout,
  type Camera,
} from "./camera";
import { applySimilarity, composeSimilarity, invertSimilarity, type Similarity } from "./geometry";
import { mulberry32, type Rng } from "./prng";
import { createRegionStore, type Blob } from "./store";
import { allBlobs, growStore } from "./testShapes";

const VIEWPORT = { width: 1000, height: 700 };

const store = createRegionStore();
growStore(store, 4);
const blobs = allBlobs(store);

function pick(rng: Rng): Blob {
  return blobs[Math.floor(rng() * blobs.length)];
}

/** A camera that shows `anchor` at roughly the viewport's size, off-centre. */
function cameraOn(anchor: Blob, rng: Rng): Camera {
  return {
    anchorId: anchor.id,
    k: 200 + rng() * 1500,
    tx: rng() * VIEWPORT.width,
    ty: rng() * VIEWPORT.height,
  };
}

/** A blob's local frame in the root's, composed the plain way: down from the root. */
function fromRoot(blob: Blob): Similarity {
  let t: Similarity = { s: 1, x: 0, y: 0 };
  for (let b = blob; b.parent && b.toParent; b = b.parent) t = composeSimilarity(b.toParent, t);
  return t;
}

describe("frameToFrame", () => {
  it("agrees with composing both blobs down from the root", () => {
    const rng = mulberry32(5);
    for (let run = 0; run < 300; run++) {
      const from = pick(rng);
      const to = pick(rng);
      const expected = composeSimilarity(invertSimilarity(fromRoot(to)), fromRoot(from));
      const actual = frameToFrame(from, to);
      const scale = Math.max(1, Math.abs(expected.s), Math.abs(expected.x), Math.abs(expected.y));
      expect(Math.abs(actual.s - expected.s)).toBeLessThan(1e-9 * scale);
      expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-9 * scale);
      expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-9 * scale);
    }
  });

  it("is the identity from a blob to itself", () => {
    const rng = mulberry32(6);
    for (let run = 0; run < 20; run++) {
      const blob = pick(rng);
      expect(frameToFrame(blob, blob)).toEqual({ s: 1, x: 0, y: 0 });
    }
  });

  it("refuses blobs from different trees", () => {
    const other = createRegionStore();
    expect(() => frameToFrame(blobs[1], other.root)).toThrow(RangeError);
  });
});

describe("reanchor", () => {
  it("leaves screen points fixed to within 1e-9", () => {
    const rng = mulberry32(7);
    for (let run = 0; run < 300; run++) {
      const anchor = pick(rng);
      // The new anchor is a nearby blob, as the frame is: a parent, child, sibling or cousin.
      let next = anchor;
      for (let step = 0; step < 3; step++) {
        const up = rng() < 0.5;
        if (up && next.parent) next = next.parent;
        else if (!up && next.children?.length) next = next.children[Math.floor(rng() * next.children.length)];
      }

      const camera = cameraOn(anchor, rng);
      const moved = reanchor(camera, anchor, next);
      expect(moved.anchorId).toBe(next.id);

      // The point under each screen point, carried into the new anchor's frame by the
      // opposite route to the one `reanchor` takes, must be drawn where it was.
      const anchorToNext = frameToFrame(anchor, next);
      for (let i = 0; i < 5; i++) {
        const screen = { x: rng() * VIEWPORT.width, y: rng() * VIEWPORT.height };
        const inNext = applySimilarity(anchorToNext, screenToAnchor(camera, screen));
        const drawn = applySimilarity(cameraTransform(moved), inNext);
        expect(Math.hypot(drawn.x - screen.x, drawn.y - screen.y)).toBeLessThan(1e-9);
      }
    }
  });

  it("returns to the same camera when it comes back", () => {
    const rng = mulberry32(8);
    for (let run = 0; run < 100; run++) {
      const anchor = pick(rng);
      const next = anchor.children?.[0] ?? anchor.parent ?? anchor;
      const camera = cameraOn(anchor, rng);
      const back = reanchor(reanchor(camera, anchor, next), next, anchor);
      expect(back.anchorId).toBe(camera.anchorId);
      expect(Math.abs(back.k - camera.k)).toBeLessThan(1e-9 * camera.k);
      expect(Math.abs(back.tx - camera.tx)).toBeLessThan(1e-9 * VIEWPORT.width);
      expect(Math.abs(back.ty - camera.ty)).toBeLessThan(1e-9 * VIEWPORT.width);
    }
  });

  it("keeps the same object when the anchor doesn't change, and checks the anchor it is given", () => {
    const camera = cameraOn(blobs[1], mulberry32(9));
    expect(reanchor(camera, blobs[1], blobs[1])).toBe(camera);
    expect(() => reanchor(camera, blobs[2], blobs[1])).toThrow(RangeError);
  });
});

describe("moving the camera", () => {
  it("zooms about a screen point without moving what is under it", () => {
    const rng = mulberry32(10);
    for (let run = 0; run < 100; run++) {
      const camera = cameraOn(pick(rng), rng);
      const point = { x: rng() * VIEWPORT.width, y: rng() * VIEWPORT.height };
      const factor = 0.2 + rng() * 5;
      const zoomed = zoomAbout(camera, point, factor);

      expect(zoomed.k).toBeCloseTo(camera.k * factor, 9);
      const under = screenToAnchor(camera, point);
      const drawn = applySimilarity(cameraTransform(zoomed), under);
      expect(Math.hypot(drawn.x - point.x, drawn.y - point.y)).toBeLessThan(1e-9);
    }
  });

  it("pans by the pixels asked", () => {
    const camera = cameraOn(blobs[1], mulberry32(11));
    expect(panBy(camera, 12, -7)).toEqual({ ...camera, tx: camera.tx + 12, ty: camera.ty - 7 });
  });

  it("centres a blob at the share of the smaller side asked for", () => {
    const camera = centredCamera("", 2, VIEWPORT, 0.9);
    expect(camera).toEqual({ anchorId: "", k: (0.9 * 700) / 2, tx: 500, ty: 350 });
  });
});
