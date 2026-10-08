// Zoom for the book views (plans/deployment.md D21: every visualization can be zoomed, so its
// small parts can be seen). Zoom moves in fixed steps, so a view looks the same at a step
// however the step was reached, and Fit is the first step.

/** The zoom steps, Fit first. */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;

export const FIT_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** The nearest step to `zoom`, the smaller on a tie; anything outside the steps is clamped. */
export function snapZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return FIT_ZOOM;
  let best: number = FIT_ZOOM;
  for (const step of ZOOM_STEPS) {
    if (Math.abs(step - zoom) < Math.abs(best - zoom)) best = step;
  }
  return best;
}

/** The step after `zoom`, or the largest. */
export function zoomIn(zoom: number): number {
  const current = snapZoom(zoom);
  return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM;
}

/** The step before `zoom`, or Fit. */
export function zoomOut(zoom: number): number {
  const current = snapZoom(zoom);
  return [...ZOOM_STEPS].reverse().find((step) => step < current) ?? FIT_ZOOM;
}

/** How much a pinch must spread or close, as a ratio of finger distances, to take one step. */
export const PINCH_STEP = 1.25;

/**
 * One pinch reading: the step a pinch from `startDistance` to `distance` asks for, or null
 * while it hasn't moved a full step either way.
 */
export function pinchZoom(zoom: number, startDistance: number, distance: number): number | null {
  if (startDistance <= 0 || distance <= 0) return null;
  const ratio = distance / startDistance;
  if (ratio >= PINCH_STEP) return zoomIn(zoom);
  if (ratio <= 1 / PINCH_STEP) return zoomOut(zoom);
  return null;
}
