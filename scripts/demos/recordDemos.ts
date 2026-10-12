// Records the Overview page's demo GIFs (public/demos/) by driving the running app in
// Playwright. Each demo is a scripted walk through one page: screenshots are taken as fast as
// the browser allows while the script moves a pretend cursor, clicks and types, and a camera
// zooms in on what is being used. The cursor and the camera are drawn afterwards with sharp,
// so the cursor stays large and readable however far the camera is zoomed out.
//
//   npm run demos:record                 records every demo (needs `npm run dev` running)
//   npm run demos:record -- explorer     records only the named ones
//
// The Labyrinth needs an account, so its demo signs in as E2E_EMAIL / E2E_PASSWORD.

import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import sharp, { type OverlayOptions } from "sharp";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "public", "demos");
/** The browser window the demos are recorded in. */
const VIEW = { width: 1600, height: 900 };
/** The GIF's size; 16:9 like the Overview's demo window. */
const OUT = { width: 854, height: 480 };

/** At most about 12 frames a second, which keeps the GIFs small. */
const FRAME_MS = 100;

type Point = { x: number; y: number };
type Camera = { x: number; y: number; scale: number };
type Frame = { jpeg: Buffer; at: number; mouse: Point; camera: Camera; clickAge: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class Recorder {
  frames: Frame[] = [];
  mouse: Point = { x: VIEW.width * 0.6, y: VIEW.height * 0.6 };
  camera: Camera = { x: VIEW.width / 2, y: VIEW.height / 2, scale: 1 };
  private lastClick = -Infinity;
  private recording = false;
  private loop: Promise<void> | null = null;
  private start = 0;

  constructor(readonly page: Page) {}

  begin() {
    this.recording = true;
    this.start = Date.now();
    this.loop = (async () => {
      while (this.recording) {
        const shot = Date.now();
        const at = Date.now() - this.start;
        const mouse = { ...this.mouse };
        const camera = { ...this.camera };
        const clickAge = Date.now() - this.lastClick;
        try {
          const jpeg = await this.page.screenshot({ type: "jpeg", quality: 90 });
          this.frames.push({ jpeg, at, mouse, camera, clickAge });
        } catch {
          // A navigation can interrupt a screenshot; the next one catches up.
        }
        await sleep(Math.max(0, FRAME_MS - (Date.now() - shot)));
      }
    })();
  }

  async end() {
    this.recording = false;
    await this.loop;
  }

  hold(ms: number) {
    return sleep(ms);
  }

  /** Moves the cursor smoothly to a point. */
  async move(to: Point, ms = 600) {
    const from = { ...this.mouse };
    const steps = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps);
      this.mouse = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
      await this.page.mouse.move(this.mouse.x, this.mouse.y);
      await sleep(ms / steps);
    }
  }

  async center(locator: Locator): Promise<Point> {
    await locator.waitFor({ state: "visible", timeout: 30_000 });
    const box = await locator.boundingBox();
    if (!box) throw new Error(`No box for ${locator}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async moveTo(locator: Locator, ms = 600) {
    await this.move(await this.center(locator), ms);
  }

  async click(locator: Locator, ms = 600) {
    await this.moveTo(locator, ms);
    await sleep(120);
    this.lastClick = Date.now();
    await this.page.mouse.down();
    await sleep(60);
    await this.page.mouse.up();
    await sleep(250);
  }

  async type(text: string, perKey = 90) {
    await this.page.keyboard.type(text, { delay: perKey });
  }

  /** Moves the camera smoothly; `scale` 1 shows the whole window. */
  async zoom(to: Partial<Camera>, ms = 900) {
    const from = { ...this.camera };
    const target = { ...from, ...to };
    const steps = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps);
      this.camera = {
        x: lerp(from.x, target.x, t),
        y: lerp(from.y, target.y, t),
        scale: lerp(from.scale, target.scale, t),
      };
      await sleep(ms / steps);
    }
  }

  async zoomOn(locator: Locator, scale: number, ms = 900) {
    await this.zoom({ ...(await this.center(locator)), scale }, ms);
  }

  zoomOut(ms = 900) {
    return this.zoom({ x: VIEW.width / 2, y: VIEW.height / 2, scale: 1 }, ms);
  }
}

/** The pointer, drawn larger than life so it reads at the GIF's size. */
function cursorSvg(size: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
      `<path d="M3 2 L3 19 L7.5 15 L10.5 22 L13.5 20.7 L10.6 14 L16.5 14 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>` +
      `</svg>`,
  );
}

function rippleSvg(radius: number, opacity: number) {
  const d = radius * 2 + 4;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}">` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${radius}" fill="rgba(234,179,8,${opacity * 0.35})" stroke="rgba(234,179,8,${opacity})" stroke-width="3"/>` +
      `</svg>`,
  );
}

async function renderFrame(frame: Frame): Promise<Buffer> {
  const { camera, mouse } = frame;
  const width = Math.round(VIEW.width / camera.scale);
  const height = Math.round(VIEW.height / camera.scale);
  const left = Math.round(Math.min(Math.max(camera.x - width / 2, 0), VIEW.width - width));
  const top = Math.round(Math.min(Math.max(camera.y - height / 2, 0), VIEW.height - height));
  const k = OUT.width / width;

  // Larger when zoomed out, where the page itself is drawn smallest.
  const cursor = Math.round(lerp(40, 30, Math.min(1, (camera.scale - 1) / 1)));
  const mx = Math.round((mouse.x - left) * k);
  const my = Math.round((mouse.y - top) * k);
  const layers: OverlayOptions[] = [];
  if (frame.clickAge < 450) {
    const t = frame.clickAge / 450;
    const radius = Math.round(10 + 22 * t);
    layers.push({ input: rippleSvg(radius, 1 - t), left: mx - radius - 2, top: my - radius - 2 });
  }
  layers.push({ input: cursorSvg(cursor), left: mx - Math.round(cursor * 0.12), top: my - Math.round(cursor * 0.08) });

  const base = await sharp(frame.jpeg)
    .extract({ left, top, width, height })
    .resize(OUT.width, OUT.height, { kernel: "lanczos3" })
    .toBuffer();
  // Parts of the cursor off the frame's edge are dropped rather than refused.
  const inside = layers.filter(
    (layer) =>
      (layer.left ?? 0) >= 0 &&
      (layer.top ?? 0) >= 0 &&
      (layer.left ?? 0) + 70 < OUT.width &&
      (layer.top ?? 0) + 70 < OUT.height,
  );
  return sharp(base).composite(inside).png().toBuffer();
}

async function writeGif(name: string, frames: Frame[], seconds: number) {
  const rendered: Buffer[] = [];
  const delay: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    rendered.push(await renderFrame(frames[i]));
    const next = frames[i + 1]?.at ?? frames[i].at + 1200; // a beat on the last frame before looping
    delay.push(Math.max(20, Math.round((next - frames[i].at) / 10) * 10));
  }
  // Waits on the network stretch a recording, so a long one plays back a little faster.
  const total = delay.reduce((a, b) => a + b, 0);
  const speed = Math.max(1, total / (seconds * 1000));
  for (let i = 0; i < delay.length; i++) delay[i] = Math.max(20, Math.round(delay[i] / speed / 10) * 10);
  const file = path.join(OUT_DIR, `${name}.gif`);
  await sharp(rendered, { join: { animated: true } })
    .gif({ delay, loop: 0, effort: 7, colours: 96, dither: 0.6, interFrameMaxError: 12 })
    .toFile(file);
  const played = delay.reduce((a, b) => a + b, 0) / 1000;
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${name}: ${frames.length} frames, ${played.toFixed(1)}s, ${kb} KB`);
}

// ---------------------------------------------------------------------------------------
// The demos

/** `seconds` is the most the GIF may last. */
type Demo = { url: string; seconds: number; account?: boolean; ready?: (page: Page) => Promise<void>; run: (r: Recorder) => Promise<void> };

const statRow = (page: Page, san: string) =>
  page.getByRole("button", { name: new RegExp(`^${san.replace(/[+]/g, "\\+")} (White|Black)`) }).first();

const DEMOS: Record<string, Demo> = {
  explorer: {
    seconds: 18,
    url: "/dashboard/explorer",
    ready: async (page) => {
      await statRow(page, "e4").waitFor({ timeout: 60_000 });
    },
    run: async (r) => {
      const { page } = r;
      await r.hold(700);
      // Play a move on the board itself.
      await r.zoomOn(page.locator('[data-square="e4"]'), 1.7);
      await r.click(page.locator('[data-square="e2"]'));
      await r.click(page.locator('[data-square="e4"]'), 450);
      await r.hold(500);
      await r.zoomOut();
      // Then follow what masters play, from the statistics.
      await statRow(page, "c5").waitFor();
      await r.zoomOn(statRow(page, "c5"), 1.8);
      await r.click(statRow(page, "c5"));
      await r.hold(400);
      await statRow(page, "Nf3").waitFor();
      await r.click(statRow(page, "Nf3"), 500);
      await r.hold(400);
      await statRow(page, "d6").waitFor();
      await r.click(statRow(page, "d6"), 500);
      await r.hold(600);
      await r.zoomOut();
      await r.hold(1200);
      // Step back through the line.
      await r.click(page.getByTitle("Undo move"));
      await r.hold(500);
      await r.click(page.getByTitle("Undo move"), 250);
      await r.hold(1200);
    },
  },

  visualizations: {
    seconds: 18,
    url: "/dashboard/visualizations/labyrinth",
    account: true,
    ready: async (page) => {
      await page.locator('canvas[data-settled="true"]').waitFor({ timeout: 60_000 });
    },
    run: async (r) => {
      const { page } = r;
      const canvas = page.locator("canvas[data-settled]");
      const box = (await canvas.boundingBox())!;
      const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
      await r.hold(1000);
      // Wheel in on 1.e4's region, then on 2.Nf3 inside it, to walk deeper into a line.
      await r.move(at(0.54, 0.69), 900);
      await r.zoom({ ...at(0.54, 0.62), scale: 1.4 });
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, -120);
        await r.hold(160);
      }
      await r.hold(1600);
      await r.zoomOut();
      await r.hold(1000);
      await r.zoom({ ...r.mouse, scale: 1.4 });
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, -120);
        await r.hold(160);
      }
      await r.hold(1600);
      await r.zoomOut();
      // And back out to the start.
      for (let i = 0; i < 16; i++) {
        await page.mouse.wheel(0, 120);
        await r.hold(90);
      }
      await r.hold(1500);
    },
  },

  library: {
    seconds: 18,
    url: "/dashboard/library",
    ready: async (page) => {
      await page.getByText("Kept in this browser", { exact: true }).waitFor({ timeout: 60_000 });
    },
    run: async (r) => {
      const { page } = r;
      await r.hold(800);
      const save = page.getByRole("button", { name: "Save King's Gambit" });
      await r.zoomOn(save, 1.6);
      await r.click(save);
      await page.getByRole("heading", { name: "King's Gambit", level: 2 }).waitFor();
      await r.hold(600);
      await r.zoomOut();
      await r.hold(900);
      await r.click(page.getByRole("link", { name: "Open book page" }));
      await page.getByRole("heading", { name: "King's Gambit", level: 1 }).waitFor({ timeout: 30_000 });
      await r.hold(1000);
      const metro = page.getByRole("radio", { name: "Metro map" });
      await r.zoomOn(metro, 1.5);
      await r.click(metro);
      await r.hold(500);
      await r.zoomOut();
      await r.hold(700);
      await r.click(page.getByRole("button", { name: "Zoom in" }));
      await r.hold(400);
      await r.click(page.getByRole("button", { name: "Zoom in" }), 250);
      await r.hold(1500);
    },
  },

  bookstore: {
    seconds: 17,
    url: "/dashboard/bookstore",
    ready: async (page) => {
      await page.getByRole("list", { name: "Store books" }).getByRole("link").first().waitFor({ timeout: 60_000 });
    },
    run: async (r) => {
      const { page } = r;
      await r.hold(900);
      const black = page.getByRole("radio", { name: "Black" });
      await r.zoomOn(black, 1.6);
      await r.click(black);
      await r.hold(300);
      const search = page.getByLabel("Search the Bookstore");
      await r.click(search);
      await r.type("caro");
      await r.hold(500);
      await r.zoomOut();
      const card = page.getByRole("list", { name: "Store books" }).getByRole("link", { name: /Caro-Kann Defense/ });
      await r.click(card);
      await page.getByRole("heading", { name: "Caro-Kann Defense", level: 1 }).waitFor({ timeout: 30_000 });
      await r.hold(1300);
      const save = page.getByRole("button", { name: "Save to library" });
      await r.zoomOn(save, 1.7);
      await r.click(save);
      await page.getByText("In your library").first().waitFor();
      await r.hold(1000);
      await r.zoomOut();
      await r.hold(1200);
    },
  },

  settings: {
    seconds: 10,
    url: "/dashboard/settings",
    ready: async (page) => {
      await page.getByRole("button", { name: /Dark/ }).first().waitFor({ timeout: 60_000 });
    },
    run: async (r) => {
      const { page } = r;
      await r.hold(600);
      const mode = (label: string) => page.getByRole("button", { name: new RegExp(label) }).first();
      await r.zoomOn(mode("Slate"), 1.5);
      await r.click(mode("Dark"));
      await r.hold(400);
      await r.zoomOut(700);
      await r.hold(700);
      await r.click(mode("Sage"), 500);
      await r.hold(900);
      await r.click(mode("Terracotta"), 400);
      await r.hold(900);
      await r.click(mode("Cream"), 500);
      await r.hold(1000);
    },
  },
};

async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("The Labyrinth demo needs E2E_EMAIL and E2E_PASSWORD.");
  await page.goto(`${BASE}/auth/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
}

async function record(browser: Browser, name: string, demo: Demo) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  // The dev server's Next.js badge isn't part of the app.
  await context.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  });
  if (demo.account) await signIn(page);
  // A first visit compiles the page on the dev server; the recorded one is the second.
  await page.goto(`${BASE}${demo.url}`);
  await demo.ready?.(page);
  await page.goto(`${BASE}${demo.url}`);
  await demo.ready?.(page);
  await page.mouse.move(VIEW.width * 0.6, VIEW.height * 0.6);

  const recorder = new Recorder(page);
  recorder.begin();
  try {
    await demo.run(recorder);
  } finally {
    await recorder.end();
    await context.close();
  }
  await writeGif(name, recorder.frames, demo.seconds);
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(DEMOS);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const name of names) {
      const demo = DEMOS[name];
      if (!demo) throw new Error(`No demo named ${name}. Known: ${Object.keys(DEMOS).join(", ")}`);
      await record(browser, name, demo);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
