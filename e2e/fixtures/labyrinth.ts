import type { Page } from "@playwright/test";
import { expect } from "./test";

export const LABYRINTH = "/dashboard/visualizations/labyrinth";

/** The map's canvas. */
export function labyrinthCanvas(page: Page) {
  return page.locator("canvas[data-settled]");
}

/**
 * Waits until the map has nothing left to load or lay out (`data-settled` on the canvas,
 * set by `RegionMap`), so the next frame draws the same picture.
 */
export async function waitForSettledMap(page: Page) {
  await expect(page.locator('canvas[data-settled="true"]')).toBeVisible({ timeout: 30_000 });
}

/**
 * Zooms in by `steps` wheel notches at a point of the canvas, given as fractions of its size.
 * The wheel events are dispatched on the canvas, since mobile WebKit has no `mouse.wheel`.
 */
export async function zoomAt(page: Page, steps: number, at = { x: 0.5, y: 0.5 }) {
  const box = await labyrinthCanvas(page).boundingBox();
  if (!box) throw new Error("The Labyrinth's canvas isn't on the page.");
  const clientX = box.x + box.width * at.x;
  const clientY = box.y + box.height * at.y;
  for (let i = 0; i < steps; i++) {
    await labyrinthCanvas(page).dispatchEvent("wheel", { deltaY: -120, clientX, clientY });
  }
}
