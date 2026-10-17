// Takes the screenshot of each visualization that the Visualizations chapter shows on its right
// page (plans/book-ui.md D18), in the light and the dark theme, into public/visualizations/
// (`visualizationShot` in src/lib/auth/access.ts). Each is the visualization's drawing, cut to
// 16:9 about its middle, from its own page in the running app; a book view's is cut about its
// moves, which at Fit leave much of the drawing empty.
//
//   npm run demos:shots              takes every screenshot (needs `npm run dev` running)
//   npm run demos:shots -- treemap   takes only the named ones
//
// The Labyrinth and the prototypes need an account, so the script signs in as E2E_EMAIL /
// E2E_PASSWORD for them.

import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { VISUALIZATIONS, visualizationShot, type Visualization } from "../../src/lib/auth/access";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
/** The browser window the screenshots are taken in. */
const VIEW = { width: 1600, height: 900 };
/** The screenshot's size; 16:9 like the box it is shown in. */
const OUT = { width: 960, height: 540 };
const THEMES = ["light", "dark"] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where a visualization draws, on its page. */
function drawingOf(page: Page, visualization: Visualization): Locator {
  if (visualization.group === "Book views") {
    return page.getByRole("img", { name: `${visualization.label} of Queen's Gambit` });
  }
  if (visualization.id === "treemap") return page.locator("svg").filter({ has: page.locator("g") }).first();
  return page.locator("canvas").first();
}

/** How long a drawing takes to settle once it shows: a map loads its regions, a globe turns in. */
function settleMs(visualization: Visualization): number {
  return visualization.group === "Book views" ? 800 : 4000;
}

async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("The account-only visualizations need E2E_EMAIL and E2E_PASSWORD.");
  await page.goto(`${BASE}/auth/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
}

type Box = { x: number; y: number; width: number; height: number };

/** Room left around a book view's moves, for their labels. */
const MOVES_PADDING = 36;

/** The largest 16:9 rectangle inside `box`, about its middle. */
function middle16by9(box: Box): Box {
  const width = Math.min(box.width, (box.height * 16) / 9);
  const height = (width * 9) / 16;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** `inner`, padded and grown to 16:9 about its middle, kept inside `outer`. */
function around16by9(inner: Box, outer: Box): Box {
  let width = inner.width + 2 * MOVES_PADDING;
  let height = inner.height + 2 * MOVES_PADDING;
  if (width / height < 16 / 9) width = (height * 16) / 9;
  else height = (width * 9) / 16;
  const fit = Math.min(1, outer.width / width, outer.height / height);
  width *= fit;
  height *= fit;
  const clamp = (start: number, size: number, from: number, room: number) =>
    Math.min(Math.max(start, from), from + room - size);
  return {
    x: clamp(inner.x + inner.width / 2 - width / 2, width, outer.x, outer.width),
    y: clamp(inner.y + inner.height / 2 - height / 2, height, outer.y, outer.height),
    width,
    height,
  };
}

/** The box around every move a book view draws, or null for any other visualization. */
async function movesBox(drawing: Locator): Promise<Box | null> {
  const boxes = await drawing.locator("[data-move]").evaluateAll((moves) =>
    moves.map((move) => {
      const { x, y, width, height } = move.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

async function shoot(browser: Browser, visualization: Visualization, theme: (typeof THEMES)[number]) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: theme });
  await context.addInitScript((choice) => {
    localStorage.setItem("theme", choice);
    // The dev server's Next.js badge isn't part of the app.
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  }, theme);
  const page = await context.newPage();
  try {
    if (visualization.access === "account") await signIn(page);
    const drawing = drawingOf(page, visualization);
    // A first visit compiles the page on the dev server; the screenshot is from the second.
    await page.goto(`${BASE}${visualization.href}`);
    await drawing.waitFor({ state: "visible", timeout: 90_000 });
    await page.goto(`${BASE}${visualization.href}`);
    await drawing.waitFor({ state: "visible", timeout: 90_000 });
    await page.mouse.move(0, 0);
    await sleep(settleMs(visualization));
    const box = await drawing.boundingBox();
    if (!box) throw new Error(`${visualization.label} drew nothing to screenshot.`);
    const moves = visualization.group === "Book views" ? await movesBox(drawing) : null;
    const png = await page.screenshot({ clip: moves ? around16by9(moves, box) : middle16by9(box) });
    const out = path.join(process.cwd(), "public", visualizationShot(visualization.id, theme));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(png).resize(OUT.width, OUT.height, { fit: "cover" }).webp({ quality: 82 }).toFile(out);
    console.log(`${visualization.label}, ${theme}: ${path.relative(process.cwd(), out)}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const wanted = process.argv.slice(2);
  const unknown = wanted.filter((id) => !VISUALIZATIONS.some((visualization) => visualization.id === id));
  if (unknown.length) {
    throw new Error(`No visualization named ${unknown.join(", ")}. Known: ${VISUALIZATIONS.map((v) => v.id).join(", ")}`);
  }
  const chosen = VISUALIZATIONS.filter((visualization) => !wanted.length || wanted.includes(visualization.id));
  const browser = await chromium.launch();
  try {
    for (const visualization of chosen) {
      for (const theme of THEMES) await shoot(browser, visualization, theme);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
