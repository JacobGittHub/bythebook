// The view of a second level (plans/book-ui.md D8): a camera zoomed in on the right page until
// it fills the window but for `ZOOM_SHOWN` of the left page at the window's left edge, with the
// cover's top at the desk's top and the book running on past the window's bottom. The book is
// laid out as ever (layout.ts); the camera only maps it onto the window, so the book never
// changes size or shape (D5). Pure, so its invariants are tested in Node (camera.test.ts).

import { PAGE_BORDER, type SpreadLayout } from "./layout";

/** How much of the left page a second level leaves in view at the window's left edge, in window pixels (D8). */
export const ZOOM_SHOWN = 290;

/** A camera: it shows the point `p` of the book, as laid out, at `scale · p + (x, y)` on the window. */
export type Camera = { scale: number; x: number; y: number };

/** The camera of a first level: the book as laid out. */
export const NO_CAMERA: Camera = { scale: 1, x: 0, y: 0 };

export type Point = { x: number; y: number };

/** Where `camera` shows the book's point `p`. */
export function project(camera: Camera, p: Point): Point {
  return { x: camera.scale * p.x + camera.x, y: camera.scale * p.y + camera.y };
}

/** The camera of a second level in the spread: the spine lands `ZOOM_SHOWN` from the window's left edge, the cover's right edge on its right edge, and the cover's top on the desk's top. */
export function zoomCamera(layout: SpreadLayout): Camera {
  const spine = layout.pages[1].rect.x;
  const coverRight = layout.cover.x + layout.cover.width;
  const scale = (layout.desk.x + layout.desk.width - ZOOM_SHOWN) / (coverRight - spine);
  return { scale, x: ZOOM_SHOWN - scale * spine, y: layout.desk.y - scale * layout.cover.y };
}

/**
 * How tall a second level's page shows on the window, in window pixels: from inside its top
 * border to the window's bottom. A page laid out for the zoomed view is this tall (D8).
 */
export function shownHeight(layout: SpreadLayout, camera: Camera): number {
  const windowBottom = layout.desk.y + layout.desk.height;
  return windowBottom - project(camera, { x: 0, y: layout.pages[1].rect.y + PAGE_BORDER }).y;
}

/**
 * The CSS transform, from a `transform-origin` of `0 0`, that puts an element whose top left
 * the book's layout puts at `at` where `camera` shows it.
 */
export function cameraTransform(camera: Camera, at: Point): string {
  const to = project(camera, at);
  return `translate(${to.x - at.x}px, ${to.y - at.y}px) scale(${camera.scale})`;
}

/**
 * A picture's place on the window as a view transition draws it, from its group's transform: a
 * window point `p` of the picture, measured from its top left, lies at `scale · p + (x, y)`.
 */
export type Placed = { scale: number; x: number; y: number };

/**
 * A picture's transforms at the start and the end of a camera move from `from` to `to`, for its
 * image pair, from a `transform-origin` of `0 0`. The browser took the picture under the camera
 * `taken` and placed it at `placed`. Between the two, the browser moves the translation and the
 * scale in step, so every point of every picture goes in a straight line from where `from`
 * shows it to where `to` does, and the pictures stay together all the way.
 */
export function pictureMove(from: Camera, to: Camera, taken: Camera, placed: Placed): [string, string] {
  const at = (camera: Camera) => {
    // The window's change from `taken` to `camera`: p ↦ r·p + u.
    const r = camera.scale / taken.scale;
    const ux = camera.x - r * taken.x;
    const uy = camera.y - r * taken.y;
    // The same change in the picture's own pixels: q ↦ r·q + t, where p = placed(q).
    const tx = (r * placed.x + ux - placed.x) / placed.scale;
    const ty = (r * placed.y + uy - placed.y) / placed.scale;
    return `translate(${tx}px, ${ty}px) scale(${r})`;
  };
  return [at(from), at(to)];
}
