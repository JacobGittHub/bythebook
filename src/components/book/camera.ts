import { pictureMove, type Camera } from "@/lib/book/camera";
import { ZOOM_EASING } from "@/lib/book/turns";

// The camera's part in a turn (plans/book-ui.md D8). The live book sits where the new page's
// camera puts it from the moment the page changes; what moves is the turn's pictures. Each was
// taken under one camera (the old page's or the new one's), so each is moved on its own, from
// where the old camera shows its part of the book to where the new one does. Every point of
// every picture moves the same way (src/lib/book/camera.ts), so the pictures stay together,
// which a camera on the live book couldn't promise: not every browser moves a picture with
// the page it shows.

/** A camera's move during a turn, in milliseconds from the turn's start. */
export type CameraMove = { from: Camera; to: Camera; start: number; duration: number };

/** Moves the view transition's picture `name`, taken under the camera `taken`, with the camera. */
export function moveWithCamera(name: string, taken: Camera, move: CameraMove): Animation {
  const html = document.documentElement;
  // The group's transform turns it about its transform origin (its middle), so its top left lies
  // at origin + translation − scale · origin.
  const group = getComputedStyle(html, `::view-transition-group(${name})`);
  const m = new DOMMatrixReadOnly(group.transform && group.transform !== "none" ? group.transform : undefined);
  const [ox, oy] = group.transformOrigin.split(" ").map((v) => parseFloat(v) || 0);
  const placed = { scale: m.a, x: m.e + ox - m.a * ox, y: m.f + oy - m.a * oy };
  const [from, to] = pictureMove(move.from, move.to, taken, placed);
  return html.animate([{ transform: from }, { transform: to }], {
    duration: move.duration,
    delay: move.start,
    easing: ZOOM_EASING,
    fill: "both",
    pseudoElement: `::view-transition-image-pair(${name})`,
  });
}
