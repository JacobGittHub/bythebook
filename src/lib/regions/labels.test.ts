import { describe, expect, it } from "vitest";
import { centredCamera, zoomAbout, type Camera } from "./camera";
import {
  FULL_OVERLAP,
  LABEL_ALPHA,
  MIN_LABEL_PX,
  READING_SIZE_SHARE,
  labelOverlap,
  placeLabels,
  type Label,
} from "./labels";
import { mulberry32, type Rng } from "./prng";
import { createRegionStore, type Blob } from "./store";
import { allBlobs, growStore } from "./testShapes";
import { buildScene, containsPoint } from "./visibility";

const VIEWPORT = { width: 1000, height: 700 };

const store = createRegionStore();
growStore(store, 5);
const inner = allBlobs(store).filter((blob) => blob.children !== null);

function randomView(rng: Rng): { anchor: Blob; camera: Camera } {
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

function labelsFor(anchor: Blob, camera: Camera) {
  return placeLabels(buildScene(anchor, camera, VIEWPORT), VIEWPORT);
}

function isAncestor(ancestor: Blob, blob: Blob) {
  for (let b = blob.parent; b; b = b.parent) if (b === ancestor) return true;
  return false;
}

describe("placeLabels", () => {
  it("labels moves with their SAN and every Other as Other, never the root", () => {
    const camera = centredCamera(store.root.id, 2 * store.root.reach, VIEWPORT, 0.9);
    const labels = labelsFor(store.root, camera);
    expect(labels.length).toBeGreaterThan(5);
    for (const label of labels) {
      expect(label.blob.kind).not.toBe("root");
      expect(label.text).toBe(label.blob.kind === "other" ? "Other" : label.blob.san);
    }
  });

  it("drops the Other label once the Other is opened, and labels the moves inside it", () => {
    const opened = createRegionStore();
    growStore(opened, 1);
    const other = opened.root.children!.find((blob) => blob.kind === "other")!;
    // Fill the view with the "Other", so it and its moves have room for labels.
    const camera = centredCamera(other.id, 2 * other.reach, VIEWPORT, 0.9);
    const labelled = () => labelsFor(other, camera).map((label) => label.blob);

    expect(labelled()).toContain(other);

    opened.reveal(other);
    const inside = other.children!.filter((blob) => blob.kind === "move");
    expect(inside.length).toBeGreaterThan(0);

    const after = labelled();
    expect(after).not.toContain(other);
    expect(inside.some((blob) => after.includes(blob))).toBe(true);
  });

  it("puts each label at the centre of a drawn blob, readable and no more opaque than its blob", () => {
    const rng = mulberry32(51);
    for (let run = 0; run < 150; run++) {
      const { anchor, camera } = randomView(rng);
      const scene = buildScene(anchor, camera, VIEWPORT);
      const drawn = new Map(scene.visible.map((entry) => [entry.blob, entry]));

      const labels = placeLabels(scene, VIEWPORT);
      expect(new Set(labels.map((label) => label.blob)).size).toBe(labels.length);
      for (const label of labels) {
        const entry = drawn.get(label.blob)!;
        expect(entry).toBeDefined();
        expect(containsPoint(label.blob, entry.toScreen, label)).toBe(true);
        expect(label.size).toBeGreaterThanOrEqual(MIN_LABEL_PX);
        expect(label.alpha).toBeGreaterThan(0);
        expect(label.alpha).toBeLessThanOrEqual(LABEL_ALPHA * entry.alpha + 1e-12);
      }
    }
  });

  it("never shows a blob's label and an ancestor's at full strength on top of each other", () => {
    const rng = mulberry32(52);
    for (let run = 0; run < 150; run++) {
      const { anchor, camera } = randomView(rng);
      const labels = labelsFor(anchor, camera);

      for (const a of labels) {
        for (const b of labels) {
          if (!isAncestor(a.blob, b.blob) || labelOverlap(a, b) < FULL_OVERLAP) continue;
          // The two share one label's worth of strength between them.
          expect(a.alpha + b.alpha).toBeLessThanOrEqual(LABEL_ALPHA + 1e-9);
        }
      }
    }
  });

  it("changes a label only slightly for a slight zoom", () => {
    const rng = mulberry32(53);
    for (let run = 0; run < 150; run++) {
      const { anchor, camera } = randomView(rng);
      const point = { x: rng() * VIEWPORT.width, y: rng() * VIEWPORT.height };
      const nudged = zoomAbout(camera, point, 1.0004);

      const sceneBefore = buildScene(anchor, camera, VIEWPORT);
      const sceneAfter = buildScene(anchor, nudged, VIEWPORT);
      // Blobs entering or leaving the scene are the scene's business, tested with it.
      const drawnBefore = new Set(sceneBefore.visible.map((entry) => entry.blob));
      const drawnAfter = new Set(sceneAfter.visible.map((entry) => entry.blob));

      const before = new Map<Blob, Label>(placeLabels(sceneBefore, VIEWPORT).map((l) => [l.blob, l]));
      const after = new Map<Blob, Label>(placeLabels(sceneAfter, VIEWPORT).map((l) => [l.blob, l]));

      for (const blob of new Set([...before.keys(), ...after.keys()])) {
        if (!drawnBefore.has(blob) || !drawnAfter.has(blob)) continue;
        const change = (after.get(blob)?.alpha ?? 0) - (before.get(blob)?.alpha ?? 0);
        expect(Math.abs(change)).toBeLessThan(0.08);
      }
    }
  });

  it("hands a spot from a blob's label to its main move's as the view zooms in", () => {
    // The move sitting nearest its parent's centre while taking up most of it: their labels
    // land on each other.
    const child = allBlobs(store)
      .filter((blob) => blob.kind === "move" && blob.parent?.kind === "move" && blob.toParent!.s > 0.6)
      .sort((a, b) => offCentre(a) - offCentre(b))[0];
    const parent = child.parent!;

    const strengths = (k: number) => {
      const camera = { anchorId: parent.id, k, tx: VIEWPORT.width / 2, ty: VIEWPORT.height / 2 };
      const labels = labelsFor(parent, camera);
      const alphaOf = (blob: Blob) => labels.find((label) => label.blob === blob)?.alpha ?? 0;
      return { parent: alphaOf(parent), child: alphaOf(child) };
    };
    const reading = READING_SIZE_SHARE * Math.min(VIEWPORT.width, VIEWPORT.height);

    // With the parent at the reading size its label holds the spot. With the child there,
    // the child's does.
    const far = strengths(reading);
    expect(far.parent).toBeGreaterThan(0.5);
    expect(far.child).toBeLessThan(far.parent / 2);

    const near = strengths(reading / child.toParent!.s);
    expect(near.child).toBeGreaterThan(0.5);
    expect(near.parent).toBeLessThan(near.child / 2);
  });
});

/** How far a blob's centre is from its parent's, in the parent's units. */
function offCentre(blob: Blob) {
  return Math.hypot(blob.toParent!.x, blob.toParent!.y);
}
