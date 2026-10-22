import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEPS, clampZoom, fitZoom, pinchZoom, wheelZoom, zoomIn, zoomLabel, zoomOut } from "./zoom";

describe("zoom steps", () => {
  it("walks every step and back, stopping at either end", () => {
    let zoom: number = MIN_ZOOM;
    const up: number[] = [zoom];
    while (zoom !== MAX_ZOOM) up.push((zoom = zoomIn(zoom)));
    expect(up).toEqual([...ZOOM_STEPS]);
    const down: number[] = [zoom];
    while (zoom !== MIN_ZOOM) down.push((zoom = zoomOut(zoom)));
    expect(down).toEqual([...ZOOM_STEPS].reverse());
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM);
  });

  it("steps from a zoom between steps to the next one either way", () => {
    expect(zoomIn(1.1)).toBe(1.25);
    expect(zoomOut(1.1)).toBe(1);
  });
});

describe("smooth zoom", () => {
  it("zooms in as the wheel turns up, within the scale", () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100)).toBeLessThan(1);
    expect(wheelZoom(MAX_ZOOM, -1000)).toBe(MAX_ZOOM);
    expect(wheelZoom(MIN_ZOOM, 1000)).toBe(MIN_ZOOM);
  });

  it("follows a pinch's spread", () => {
    expect(pinchZoom(1, 100, 150)).toBe(1.5);
    expect(pinchZoom(2, 0, 70)).toBe(2);
  });

  it("clamps anything outside the scale", () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("fitZoom", () => {
  it("fits a big drawing in its box, and leaves one that fits at 1", () => {
    expect(fitZoom({ width: 400, height: 1600 }, { width: 400, height: 1000 })).toBeCloseTo(0.625);
    expect(fitZoom({ width: 400, height: 400 }, { width: 800, height: 800 })).toBe(1);
    expect(fitZoom({ width: 400, height: 100_000 }, { width: 400, height: 400 })).toBe(MIN_ZOOM);
  });

  it("writes the zoom as a percentage", () => {
    expect(zoomLabel(0.67)).toBe("67%");
  });
});
