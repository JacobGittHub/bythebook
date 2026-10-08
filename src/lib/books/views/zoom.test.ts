import { describe, expect, it } from "vitest";
import { FIT_ZOOM, MAX_ZOOM, ZOOM_STEPS, pinchZoom, snapZoom, zoomIn, zoomOut } from "./zoom";

describe("zoom steps", () => {
  it("go up and down one step at a time, stopping at Fit and the largest", () => {
    expect(zoomIn(FIT_ZOOM)).toBe(ZOOM_STEPS[1]);
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(zoomOut(ZOOM_STEPS[2])).toBe(ZOOM_STEPS[1]);
    expect(zoomOut(FIT_ZOOM)).toBe(FIT_ZOOM);
  });

  it("walks every step and back", () => {
    let zoom: number = FIT_ZOOM;
    const up: number[] = [zoom];
    while (zoom !== MAX_ZOOM) up.push((zoom = zoomIn(zoom)));
    expect(up).toEqual([...ZOOM_STEPS]);
    const down: number[] = [zoom];
    while (zoom !== FIT_ZOOM) down.push((zoom = zoomOut(zoom)));
    expect(down).toEqual([...ZOOM_STEPS].reverse());
  });

  it("snaps anything else to the nearest step", () => {
    expect(snapZoom(0.2)).toBe(FIT_ZOOM);
    expect(snapZoom(99)).toBe(MAX_ZOOM);
    expect(snapZoom(2.4)).toBe(2);
    expect(snapZoom(2.5)).toBe(2);
    expect(snapZoom(Number.NaN)).toBe(FIT_ZOOM);
    expect(zoomIn(1.9)).toBe(3);
  });
});

describe("pinchZoom", () => {
  it("takes a step only once the fingers have moved far enough", () => {
    expect(pinchZoom(1, 100, 110)).toBeNull();
    expect(pinchZoom(1, 100, 130)).toBe(1.5);
    expect(pinchZoom(2, 100, 70)).toBe(1.5);
    expect(pinchZoom(2, 0, 70)).toBeNull();
  });
});
