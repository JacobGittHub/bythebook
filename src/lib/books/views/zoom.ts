// Zoom for the book views (plans/deployment.md D21, plans/game-history.md D32 as amended): a
// continuous scale from half to four times the drawing's laid-out size. − and + move through
// fixed steps; Ctrl and the wheel, and a pinch, move smoothly. Fit is the zoom at which the whole
// drawing fits its box, which is 1 for a drawing that already fits.

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

/** The steps − and + move through. */
export const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;

/** How far one pixel of wheel travel zooms, as a power of e. */
const WHEEL_RATE = 0.002;

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : 1;
}

/** The first step above `zoom`, or the largest. */
export function zoomIn(zoom: number): number {
  return ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? MAX_ZOOM;
}

/** The last step below `zoom`, or the smallest. */
export function zoomOut(zoom: number): number {
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001) ?? MIN_ZOOM;
}

/** The zoom after a wheel turn of `deltaY` pixels: up zooms in. */
export function wheelZoom(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * WHEEL_RATE));
}

/** The zoom after a pinch whose fingers moved from `startDistance` apart to `distance`. */
export function pinchZoom(zoom: number, startDistance: number, distance: number): number {
  return startDistance > 0 && distance > 0 ? clampZoom((zoom * distance) / startDistance) : zoom;
}

/** The zoom at which a drawing of `size` (at zoom 1) fits `box`, never above 1. */
export function fitZoom(size: { width: number; height: number }, box: { width: number; height: number }): number {
  if (size.width <= 0 || size.height <= 0) return 1;
  return clampZoom(Math.min(1, box.width / size.width, box.height / size.height));
}

/** "150%", as the zoom controls write it. */
export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
