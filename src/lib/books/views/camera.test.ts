import { describe, expect, it } from "vitest";
import { buildViewTree, type ViewSource } from "@/lib/books/viewTree";
import { AUTO_MAX_ZOOM, cameraAt, easeCamera, frameCamera, highlightIndex, scrollFor, walkKey, type Camera, type FrameInput } from "./camera";
import { MIN_ZOOM } from "./zoom";

const leaf = (id: string, games: number, children: ViewSource[] = []): ViewSource => ({ id, san: id, uci: id, fen: "8/8/8/8/8/8/8/8 w - - 0 1", games, children });
// root → a (3 moves: a1, a2, a3), b
const tree = buildViewTree({ ...leaf("root", 10, [leaf("a", 6, [leaf("a1", 3), leaf("a2", 2), leaf("a3", 1)]), leaf("b", 4)]), san: null, uci: null });
const node = (id: string) => tree.byId.get(id)!;

describe("walking a view", () => {
  it("highlights the most played move until the walk says otherwise", () => {
    expect(highlightIndex(node("a"), null)).toBe(0);
    expect(highlightIndex(node("a"), { forId: "a", index: 2 })).toBe(2);
    expect(highlightIndex(node("a"), { forId: "root", index: 1 })).toBe(0);
    expect(highlightIndex(node("a1"), null)).toBe(-1);
  });

  it("moves the highlight with Up and Down, stopping at the first and last move", () => {
    expect(walkKey("ArrowDown", node("a"), null)).toEqual({ walk: { forId: "a", index: 1 }, go: null });
    expect(walkKey("ArrowDown", node("a"), { forId: "a", index: 2 })?.walk.index).toBe(2);
    expect(walkKey("ArrowUp", node("a"), null)?.walk.index).toBe(0);
  });

  it("goes to the highlighted move with Right, and back with Left onto the move it came from", () => {
    const right = walkKey("ArrowRight", node("a"), { forId: "a", index: 1 });
    expect(right?.go?.id).toBe("a2");
    const left = walkKey("ArrowLeft", node("b"), null);
    expect(left?.go?.id).toBe("root");
    expect(highlightIndex(node("root"), left!.walk)).toBe(1);
  });

  it("stays put at a line's end and at the root, and ignores other keys", () => {
    expect(walkKey("ArrowRight", node("a1"), null)?.go).toBeNull();
    expect(walkKey("ArrowLeft", tree.root, null)?.go).toBeNull();
    expect(walkKey("Enter", node("a"), null)).toBeNull();
  });
});

describe("the camera", () => {
  const view = { width: 400, height: 300 };
  const drawing = { width: 2000, height: 4000 };
  const base: FrameInput = {
    camera: { zoom: 1, x: 200, y: 150 },
    view,
    drawing,
    current: { x: 600, y: 2000 },
    moves: [{ x: 650, y: 1960 }, { x: 650, y: 2040 }],
    highlight: { x: 650, y: 1960 },
    zoom: false,
  };

  it("puts the current position a third across and its moves in the middle", () => {
    const camera = frameCamera(base);
    const { left, top } = scrollFor(camera, view);
    expect(600 * camera.zoom - left).toBeCloseTo(120);
    expect(2000 * camera.zoom - top).toBeCloseTo(150);
  });

  it("leaves the height alone while the moves are well inside the view", () => {
    const camera = frameCamera({ ...base, camera: { zoom: 1, x: 0, y: 2010 } });
    expect(camera.y).toBe(2010);
  });

  it("zooms out when the moves don't fit, and in when they sit small, up to its limit", () => {
    const wide = frameCamera({ ...base, zoom: true, moves: [{ x: 650, y: 1000 }, { x: 650, y: 3000 }] });
    expect(wide.zoom).toBeLessThan(1);
    expect(wide.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    const close = frameCamera({ ...base, zoom: true, moves: [{ x: 652, y: 1999 }, { x: 652, y: 2001 }] });
    expect(close.zoom).toBe(AUTO_MAX_ZOOM);
    expect(frameCamera({ ...base, zoom: true, camera: { ...base.camera, zoom: 3 }, moves: [{ x: 652, y: 2001 }] }).zoom).toBe(3);
  });

  it("keeps the highlighted move in view when the moves can't all fit", () => {
    const moves = [{ x: 650, y: 0 }, { x: 650, y: 3900 }];
    const camera = frameCamera({ ...base, camera: { zoom: MIN_ZOOM, x: 0, y: 0 }, moves, highlight: moves[1] });
    const { top } = scrollFor(camera, view);
    expect(3900 * camera.zoom).toBeGreaterThan(top);
    expect(3900 * camera.zoom).toBeLessThan(top + view.height);
  });

  it("never shows past the drawing's edges", () => {
    const camera = frameCamera({ ...base, current: { x: 10, y: 10 }, moves: [], highlight: null });
    expect(scrollFor(camera, view)).toEqual({ left: 0, top: 0 });
  });

  it("reads back the camera a scroll position shows", () => {
    const camera: Camera = { zoom: 1.5, x: 700, y: 900 };
    const back = cameraAt(scrollFor(camera, view), 1.5, view);
    expect(back.x).toBeCloseTo(700);
    expect(back.y).toBeCloseTo(900);
  });

  it("eases from one camera to the next, zooming by equal ratios", () => {
    const from = { zoom: 1, x: 0, y: 0 };
    const to = { zoom: 4, x: 100, y: 100 };
    expect(easeCamera(from, to, 0)).toEqual(from);
    expect(easeCamera(from, to, 1)).toEqual(to);
    expect(easeCamera(from, to, 0.5).zoom).toBeCloseTo(2);
  });
});
