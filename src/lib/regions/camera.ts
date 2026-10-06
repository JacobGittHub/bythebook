import {
  applySimilarity,
  composeSimilarity,
  invertSimilarity,
  type Similarity,
  type Vec,
} from "./geometry";

/** The part of a blob the camera needs: its place in the tree and in its parent's frame. */
export type Framed = {
  readonly id: string;
  readonly parent: Framed | null;
  /** Maps this blob's local frame into its parent's. Null at the root. */
  readonly toParent: Similarity | null;
};

/**
 * A floating-origin camera: a point `p` in the anchor blob's local frame is drawn at
 * `k · p + (tx, ty)`, in CSS pixels. The anchor follows the frame blob, so `k` stays near
 * the viewport's size however deep the zoom goes.
 */
export type Camera = {
  readonly anchorId: string;
  readonly k: number;
  readonly tx: number;
  readonly ty: number;
};

export type Viewport = { readonly width: number; readonly height: number };

const IDENTITY: Similarity = { s: 1, x: 0, y: 0 };

/** The camera as a map from the anchor's local frame to the screen. */
export function cameraTransform(camera: Camera): Similarity {
  return { s: camera.k, x: camera.tx, y: camera.ty };
}

/**
 * Maps `from`'s local frame into `to`'s, through their nearest common ancestor. Only the
 * blobs between the two are composed, never the path down from the root, so the result stays
 * precise at any depth.
 */
export function frameToFrame(from: Framed, to: Framed): Similarity {
  const toChain: Framed[] = [];
  for (let b: Framed | null = to; b; b = b.parent) toChain.push(b);
  const indexInChain = new Map(toChain.map((b, i) => [b, i]));

  let fromToCommon = IDENTITY;
  let common: Framed | null = from;
  while (common && !indexInChain.has(common)) {
    if (!common.toParent) break;
    fromToCommon = composeSimilarity(common.toParent, fromToCommon);
    common = common.parent;
  }
  const steps = common ? indexInChain.get(common) : undefined;
  if (steps === undefined) throw new RangeError("The two blobs are not in the same tree");

  let toToCommon = IDENTITY;
  for (let i = 0; i < steps; i++) {
    toToCommon = composeSimilarity(toChain[i].toParent!, toToCommon);
  }
  return composeSimilarity(invertSimilarity(toToCommon), fromToCommon);
}

/** The same view, expressed in `next`'s local frame. Nothing moves on screen. */
export function reanchor(camera: Camera, anchor: Framed, next: Framed): Camera {
  if (anchor.id !== camera.anchorId) throw new RangeError("`anchor` is not the camera's anchor");
  if (next === anchor) return camera;
  const t = composeSimilarity(cameraTransform(camera), frameToFrame(next, anchor));
  return { anchorId: next.id, k: t.s, tx: t.x, ty: t.y };
}

/** Scales the view by `factor`, keeping the screen point `point` where it is. */
export function zoomAbout(camera: Camera, point: Vec, factor: number): Camera {
  return {
    anchorId: camera.anchorId,
    k: camera.k * factor,
    tx: point.x + (camera.tx - point.x) * factor,
    ty: point.y + (camera.ty - point.y) * factor,
  };
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, tx: camera.tx + dx, ty: camera.ty + dy };
}

/** The point of the anchor's local frame drawn at the screen point `point`. */
export function screenToAnchor(camera: Camera, point: Vec): Vec {
  return applySimilarity(invertSimilarity(cameraTransform(camera)), point);
}

/**
 * A camera that centres a blob's local origin in the viewport, with the blob `size` local
 * units across filling `share` of the viewport's smaller side.
 */
export function centredCamera(
  anchorId: string,
  size: number,
  viewport: Viewport,
  share: number,
): Camera {
  return {
    anchorId,
    k: (share * Math.min(viewport.width, viewport.height)) / size,
    tx: viewport.width / 2,
    ty: viewport.height / 2,
  };
}

/** A camera in the root's frame, as the Labyrinth's `?camera=` address parameter holds it. */
export type RootCamera = Pick<Camera, "k" | "tx" | "ty">;

/**
 * Writes a root-frame camera as `k,tx,ty`. The root frame is used because the page can show
 * it before anything below the root has loaded; the map re-anchors as the data arrives.
 */
export function formatRootCamera({ k, tx, ty }: RootCamera): string {
  return [k, tx, ty].map((n) => String(n)).join(",");
}

/** Reads `formatRootCamera`'s output. Null for anything else. */
export function parseRootCamera(param: string | undefined | null): RootCamera | null {
  const parts = param?.split(",") ?? [];
  if (parts.length !== 3 || parts.some((part) => part.trim() === "")) return null;
  const [k, tx, ty] = parts.map(Number);
  if (![k, tx, ty].every(Number.isFinite) || k <= 0) return null;
  return { k, tx, ty };
}
