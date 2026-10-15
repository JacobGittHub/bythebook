import { describe, expect, it } from "vitest";
import { mulberry32, type Rng } from "@/lib/regions/prng";
import { expectNoViolations } from "@/lib/regions/testShapes";
import {
  NO_CAMERA,
  ZOOM_SHOWN,
  cameraTransform,
  pictureMove,
  project,
  shownHeight,
  zoomCamera,
  type Camera,
  type Placed,
  type Point,
} from "./camera";
import { BOOK_WINDOW_SIZES, PAGE_BORDER, chaptersFor, formFor, layoutBook, type SpreadLayout } from "./layout";

/** Pixels of rounding a check allows. */
const EPS = 1e-6;

/** The spread's layout at every listed window size that gets one, for each chapter of an eight-chapter book. */
function spreads(): [string, SpreadLayout][] {
  const out: [string, SpreadLayout][] = [];
  for (const size of BOOK_WINDOW_SIZES) {
    if (formFor(size) !== "spread") continue;
    for (let at = 0; at < 8; at++) {
      const layout = layoutBook({ window: size, form: "spread", at, pages: 8, tabs: [], chapters: chaptersFor(size) });
      if (layout.form === "spread") out.push([`${size.name}, chapter ${at}`, layout]);
    }
  }
  return out;
}

/** Applies a CSS `translate(…px, …px) scale(…)` from a `transform-origin` of `0 0`. */
function applyCss(transform: string, p: Point): Point {
  const [tx, ty, s] = (transform.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
  return { x: tx + s * p.x, y: ty + s * p.y };
}

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 * Math.max(1, Math.abs(b.x)) && Math.abs(a.y - b.y) < 1e-6 * Math.max(1, Math.abs(b.y));
const randomCamera = (rng: Rng): Camera => ({ scale: 0.5 + rng() * 2, x: (rng() - 0.5) * 3000, y: (rng() - 0.5) * 3000 });

describe("zoomCamera", () => {
  it("leaves ZOOM_SHOWN of the left page in view and fits the book's right side to the window (D8)", () => {
    const wrong: string[] = [];
    for (const [name, layout] of spreads()) {
      const camera = zoomCamera(layout);
      const [left, right] = layout.pages.map((p) => p.rect);
      const spine = project(camera, { x: right.x, y: right.y });
      const coverTopRight = project(camera, { x: layout.cover.x + layout.cover.width, y: layout.cover.y });
      if (Math.abs(spine.x - ZOOM_SHOWN) > EPS) wrong.push(`${name}: the spine lands at ${spine.x}`);
      if (Math.abs(coverTopRight.x - layout.desk.width) > EPS) wrong.push(`${name}: the cover's right edge lands at ${coverTopRight.x}`);
      if (Math.abs(coverTopRight.y - layout.desk.y) > EPS) wrong.push(`${name}: the cover's top lands at ${coverTopRight.y}, not on the desk's top`);
      if (!(camera.scale > 1)) wrong.push(`${name}: the camera doesn't zoom in (${camera.scale})`);
      // The left page's fore-edge is out of view, and the book runs on past the window's bottom.
      if (project(camera, { x: left.x, y: 0 }).x >= 0) wrong.push(`${name}: the whole left page shows`);
      const pageBottom = project(camera, { x: 0, y: right.y + right.height }).y;
      if (pageBottom <= layout.desk.y + layout.desk.height) wrong.push(`${name}: the page ends at ${pageBottom}, in the window`);
    }
    expectNoViolations(wrong);
  });

  it("gives a second level's page more room than a first level's, as tall as it shows (D8)", () => {
    const wrong: string[] = [];
    for (const [name, layout] of spreads()) {
      const camera = zoomCamera(layout);
      const page = layout.pages[1].rect;
      const height = shownHeight(layout, camera);
      const top = project(camera, { x: page.x, y: page.y + PAGE_BORDER }).y;
      if (Math.abs(top + height - (layout.desk.y + layout.desk.height)) > EPS) wrong.push(`${name}: the shown page doesn't reach the window's bottom`);
      if (!(height < page.height * camera.scale)) wrong.push(`${name}: the page shows whole`);
      if (!(height > page.height)) wrong.push(`${name}: the shown page (${height}px) is shorter than the first level's (${page.height}px)`);
      if (!(page.width * camera.scale > page.width)) wrong.push(`${name}: the shown page is no wider`);
    }
    expectNoViolations(wrong);
  });
});

describe("cameraTransform", () => {
  it("puts every point of an element where the camera shows it", () => {
    const rng = mulberry32(11);
    const wrong: string[] = [];
    for (let run = 0; run < 500; run++) {
      const camera = randomCamera(rng);
      const at = { x: rng() * 2000, y: rng() * 1200 };
      const q = { x: rng() * 900, y: rng() * 900 };
      const shown = applyCss(cameraTransform(camera, at), q);
      const want = project(camera, { x: at.x + q.x, y: at.y + q.y });
      if (!near({ x: at.x + shown.x, y: at.y + shown.y }, want)) wrong.push(`run ${run}: (${shown.x}, ${shown.y}) from ${at.x}, ${at.y}`);
    }
    expect(cameraTransform(NO_CAMERA, { x: 40, y: 70 })).toBe("translate(0px, 0px) scale(1)");
    expectNoViolations(wrong);
  });
});

describe("pictureMove", () => {
  it("starts and ends every picture where the camera move's ends show its book", () => {
    const rng = mulberry32(12);
    const wrong: string[] = [];
    for (let run = 0; run < 1000; run++) {
      const from = rng() < 0.3 ? NO_CAMERA : randomCamera(rng);
      const to = rng() < 0.3 ? NO_CAMERA : randomCamera(rng);
      const taken = rng() < 0.5 ? from : to;
      // The element's top left in the book, and its group: the browser places the picture where `taken` shows it.
      const at = { x: rng() * 1500, y: rng() * 900 };
      const placedAt = project(taken, at);
      const placed: Placed = { scale: taken.scale, x: placedAt.x, y: placedAt.y };
      const [start, end] = pictureMove(from, to, taken, placed);
      for (let k = 0; k < 4; k++) {
        const q = { x: rng() * 700, y: rng() * 700 };
        const book = { x: at.x + q.x, y: at.y + q.y };
        const onWindow = (css: string) => {
          const local = applyCss(css, q);
          return { x: placed.scale * local.x + placed.x, y: placed.scale * local.y + placed.y };
        };
        if (!near(onWindow(start), project(from, book))) wrong.push(`run ${run}: the picture doesn't start where \`from\` shows it`);
        if (!near(onWindow(end), project(to, book))) wrong.push(`run ${run}: the picture doesn't end where \`to\` shows it`);
      }
    }
    expectNoViolations(wrong);
  });

  it("leaves a picture alone when the camera stays where it was taken", () => {
    const camera = { scale: 1.6, x: -800, y: -40 };
    const [start, end] = pictureMove(camera, camera, camera, { scale: 1.6, x: 300, y: 70 });
    expect(applyCss(start, { x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    expect(end).toBe(start);
  });
});
