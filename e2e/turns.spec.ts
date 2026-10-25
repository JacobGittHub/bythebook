import type { Locator, Page } from "@playwright/test";
import { MOTION_STORAGE_KEY, type Motion } from "@/lib/appearance";
import { ZOOM_SHOWN } from "@/lib/book/camera";
import { SPREAD, SPREAD_MIN_WIDTH } from "@/lib/book/layout";
import { LIBRARY, bookList, createPastedBook } from "./fixtures/library";
import { expect, test } from "./fixtures/test";

// The book's moves between pages (plans/book-ui.md D8, D13, D14): page turns, or none, and a
// second level's zoom and scroll. A move is recorded as the browser starts its animations: each animation's
// name and the picture it moves, and `camera` for each picture the camera moves.

declare global {
  interface Window {
    __moves: string[][];
  }
}

async function recordMoves(page: Page, motion: Motion) {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
      window.__moves = [];
      const start = Document.prototype.startViewTransition;
      if (!start) return;
      Document.prototype.startViewTransition = function (this: Document, ...args: Parameters<Document["startViewTransition"]>) {
        const transition = start.apply(this, args);
        // A frame after the pictures are ready, so the camera's animations have started too.
        transition.ready.then(
          () =>
            requestAnimationFrame(() =>
              window.__moves.push(
                document
                  .getAnimations()
                  .filter((a) => {
                    const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement ?? "";
                    return a instanceof CSSAnimation ? pseudo.startsWith("::view-transition") : pseudo.startsWith("::view-transition-image-pair");
                  })
                  .map((a) => `${a instanceof CSSAnimation ? a.animationName : "camera"} ${(a.effect as KeyframeEffect).pseudoElement}`),
              ),
            ),
          () => window.__moves.push([]),
        );
        return transition;
      } as Document["startViewTransition"];
    },
    [MOTION_STORAGE_KEY, motion],
  );
}

/** Goes to a chapter by its tab, or its row in the one-page form's column, and returns the move's animations. */
async function moveTo(page: Page, label: string, href: string): Promise<string[]> {
  return follow(page, page.getByRole("navigation", { name: "Chapters" }).getByRole("link", { name: label, exact: true }), href);
}

/** How long a move may take to start once the address has changed. */
const MOVE_WAIT_MS = 3_000;

/** Follows a link to `href` and returns the move's animations. */
async function follow(page: Page, link: Locator, href: string): Promise<string[]> {
  const before = await page.evaluate(() => window.__moves.length);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  // The move is recorded once the browser has its pictures, which a slow browser takes a while
  // over. Under None no transition starts, so the wait runs out.
  await page.waitForFunction((n) => window.__moves.length > n, before, { timeout: MOVE_WAIT_MS }).catch(() => {});
  const moves = await page.evaluate(() => window.__moves);
  return moves.length > before ? moves[moves.length - 1] : [];
}

const form = (page: Page) => page.locator(".book-frame").getAttribute("data-form");
/** Where the right page starts on the window: at the spine, or `ZOOM_SHOWN` in on a second level. */
const rightPageAt = (page: Page) =>
  page.locator('.book > .book-page[data-side="right"]').evaluate((el) => Math.round(el.getBoundingClientRect().left));
const route = (href: string) => href.replace(/[^a-z0-9]+/gi, "-");
/** Whether the window gets the spread; read from its width, since the server renders the last visit's form until the page starts. */
const spreadWindow = (page: Page) => page.viewportSize()!.width >= SPREAD_MIN_WIDTH;
const supportsTurns = (page: Page) => page.evaluate(() => "startViewTransition" in document);

/**
 * The animation that says a move from `from` to `to` (routes as the pages name their pictures)
 * went `way`: the leaf that turns first.
 */
function expected(way: "forward" | "back", spread: boolean, from: string, to: string): string {
  if (!spread) {
    // One page: forward, the next leaf comes over onto it; back, this one lifts away.
    return way === "forward"
      ? `turn-lift-single ::view-transition-new(page-s${to})`
      : `turn-lift-single ::view-transition-old(page-s${from})`;
  }
  return way === "forward"
    ? `turn-fold-right ::view-transition-old(page-r${from})`
    : `turn-fold-left ::view-transition-old(page-l${from})`;
}

test("Page turn: moves forward and back in book order", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto("/dashboard/library");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "turn");
  const spread = (await form(page)) === "spread";

  const forward = await moveTo(page, "Bookstore", "/dashboard/bookstore");
  expect(forward).toContain(expected("forward", spread, "-dashboard-library", "-dashboard-bookstore"));
  expect(forward.some((a) => a.includes("riffle"))).toBe(false);

  const back = await moveTo(page, "Library", "/dashboard/library");
  expect(back).toContain(expected("back", spread, "-dashboard-bookstore", "-dashboard-library"));
});

test("Page turn: a jump of several chapters riffles the leaves between, up to three", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto("/dashboard");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  const riffles = (moves: string[]) => moves.filter((a) => /^turn-(riffle-(forward|back)|lift-single) .*riffle/.test(a));

  // Overview to Library: Explorer and Visualizations riffle past.
  expect(riffles(await moveTo(page, "Library", "/dashboard/library"))).toHaveLength(2);
  // Library to Settings: the Bookstore, Train and Puzzles riffle past.
  expect(riffles(await moveTo(page, "Settings", "/dashboard/settings"))).toHaveLength(3);
  // The leaves are gone once the turn is over.
  await expect(page.locator(".book-riffle")).toHaveCount(0, { timeout: 5_000 });
  // Back to the Overview: six chapters between, of which three riffle.
  expect(riffles(await moveTo(page, "Overview", "/dashboard"))).toHaveLength(3);
});

test("Page turn: a second level turns, then zooms in, and zooms out, then turns back (D8)", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto("/dashboard/bookstore");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  test.skip(!spreadWindow(page), "Only the spread zooms; the one-page form turns as between chapters.");
  const spine = await rightPageAt(page);

  const link = page.locator('a[href^="/dashboard/bookstore/"]').first();
  const href = (await link.getAttribute("href"))!;
  const into = await follow(page, link, href);
  expect(into).toContain(`turn-fold-right ::view-transition-old(page-r-dashboard-bookstore)`);
  expect(into).toContain(`camera ::view-transition-image-pair(page-r-dashboard-bookstore)`);
  expect(into).toContain(`camera ::view-transition-image-pair(page-l${route(href)})`);
  expect(into).toContain("camera ::view-transition-image-pair(book)");
  // Zoomed in, the left page shows ZOOM_SHOWN at the window's edge.
  await expect.poll(() => rightPageAt(page)).toBe(ZOOM_SHOWN);

  const out = await follow(page, page.getByRole("link", { name: "Back to the shelf" }), "/dashboard/bookstore");
  expect(out).toContain(`turn-fold-left ::view-transition-old(page-l${route(href)})`);
  expect(out).toContain(`camera ::view-transition-image-pair(page-r-dashboard-bookstore)`);
  await expect.poll(() => rightPageAt(page)).toBe(spine);
});

test("Page turn: a Library book's page is a whole spread, which turns but isn't zoomed in on (plans/game-history.md D40)", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto(LIBRARY);
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  test.skip(!spreadWindow(page), "Only the spread zooms; the one-page form turns as between chapters.");
  const spine = await rightPageAt(page);
  await createPastedBook(page, "Whole book");
  const open = page.getByRole("link", { name: "Open book page" });
  const before = await page.evaluate(() => window.__moves.length);
  await open.click();
  // The page's first visit compiles in the dev server, so its turn may start later than most.
  await expect.poll(() => page.evaluate(() => window.__moves.length), { timeout: 15_000 }).toBeGreaterThan(before);
  const into = await page.evaluate(() => window.__moves[window.__moves.length - 1]);
  expect(into.some((move) => move.startsWith("turn-")), into.join(", ")).toBe(true);
  expect(into.some((move) => move.startsWith("camera"))).toBe(false);
  await expect(page.getByRole("heading", { name: "Whole book", level: 1 })).toBeVisible();
  expect(await rightPageAt(page)).toBe(spine);
});

test("Page turn: another book on a second level neither turns nor zooms; its page re-inks (D8, D13)", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto("/dashboard/bookstore");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  test.skip(!spreadWindow(page), "Only the spread zooms; the one-page form shows a second level's own page alone.");
  // The way in turns and zooms; it is waited for until recorded, so a slow browser's late record
  // of it isn't taken for the next move's.
  const open = page.locator('a[href^="/dashboard/bookstore/"]').first();
  await follow(page, open, (await open.getAttribute("href"))!);
  await expect.poll(() => rightPageAt(page)).toBe(ZOOM_SHOWN);

  const before = page.url();
  const link = bookList(page).getByRole("link").nth(1);
  const moves = await follow(page, link, (await link.getAttribute("href"))!);
  expect(moves.filter((move) => move.startsWith("turn-") || move.startsWith("camera"))).toEqual([]);
  await expect(page).not.toHaveURL(before);
  // The right page re-inks, its first screen and what lies below; the list beside it doesn't.
  await expect(page.locator('[data-slot="page"][data-side="right"] .book-ink')).toHaveCount(2);
  await expect(page.locator('[data-slot="page"][data-side="left"] .book-ink')).toHaveCount(0);
  expect(await rightPageAt(page)).toBe(ZOOM_SHOWN);
});

test("Page turn: a second level's view scrolls down the book, the strip going up with the desk, and goes back from there (D8)", async ({ page }) => {
  await recordMoves(page, "turn");
  await page.goto("/dashboard/bookstore");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  test.skip(!spreadWindow(page), "Only the spread zooms; the one-page form's page scrolls as any other.");
  const spine = await rightPageAt(page);
  const open = page.locator('a[href^="/dashboard/bookstore/"]').first();
  const href = (await open.getAttribute("href"))!;
  await open.click();
  await expect.poll(() => rightPageAt(page)).toBe(ZOOM_SHOWN);
  const strip = page.locator(".book-strip");
  const stripBottom = () => strip.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  expect(await stripBottom()).toBe(SPREAD.strip);

  // The strip goes up with the desk as the view scrolls, as part of it, rather than sliding.
  const desk = page.locator(".book-desk");
  await desk.evaluate((el) => (el.scrollTop = 20));
  await expect.poll(stripBottom).toBe(SPREAD.strip - 20);
  await desk.evaluate((el) => (el.scrollTop = 0));
  await expect.poll(stripBottom).toBe(SPREAD.strip);

  // Scrolled down, what lies below the first screen comes into view and the strip hides. The
  // wheel is over the book's title, since the drawing scrolls itself.
  await page.mouse.move(700, 150);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByRole("heading", { name: "About this book" })).toBeInViewport();
  await expect.poll(stripBottom).toBeLessThanOrEqual(0);
  // The mouse at the window's top brings it back, and it goes once the mouse leaves it.
  await page.mouse.move(600, 2);
  await expect.poll(stripBottom).toBe(SPREAD.strip);
  await page.mouse.move(600, 400);
  await expect.poll(stripBottom).toBeLessThanOrEqual(0);

  // Back from the scrolled view: the camera zooms out from where the view was, and the leaf turns back.
  await page.mouse.move(600, 2);
  await expect.poll(stripBottom).toBe(SPREAD.strip);
  const out = await moveTo(page, "Bookstore", "/dashboard/bookstore");
  expect(out).toContain(`turn-fold-left ::view-transition-old(page-l${route(href)})`);
  expect(out).toContain("camera ::view-transition-image-pair(book)");
  await expect.poll(() => rightPageAt(page)).toBe(spine);
  await expect.poll(stripBottom).toBe(SPREAD.strip);
});

test("Page turn: in the one-page form a second level turns forward, and back by its back link (D15)", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await recordMoves(page, "turn");
  await page.goto("/dashboard/bookstore");
  test.skip(!(await supportsTurns(page)), "This browser has no view transitions; pages change at once.");
  await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "single");

  const link = page.locator('a[href^="/dashboard/bookstore/"]').first();
  const href = (await link.getAttribute("href"))!;
  const into = await follow(page, link, href);
  expect(into).toContain(expected("forward", false, "-dashboard-bookstore", route(href)));
  expect(into.some((a) => a.startsWith("camera"))).toBe(false);

  const out = await follow(page, page.getByRole("link", { name: "Back to Bookstore" }), "/dashboard/bookstore");
  expect(out).toContain(expected("back", false, route(href), "-dashboard-bookstore"));
});

test("None: pages change at once", async ({ page }) => {
  await recordMoves(page, "none");
  await page.goto("/dashboard/library");
  expect(await moveTo(page, "Bookstore", "/dashboard/bookstore")).toEqual([]);
});

test("None: a second level zooms at once", async ({ page }) => {
  await recordMoves(page, "none");
  await page.goto("/dashboard/bookstore");
  test.skip(!spreadWindow(page), "Only the spread zooms.");
  const link = page.locator('a[href^="/dashboard/bookstore/"]').first();
  expect(await follow(page, link, (await link.getAttribute("href"))!)).toEqual([]);
  await expect.poll(() => rightPageAt(page)).toBe(ZOOM_SHOWN);
});

test("Reduced motion: pages change at once, whatever the setting", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordMoves(page, "turn");
  await page.goto("/dashboard/library");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "none");
  expect(await moveTo(page, "Bookstore", "/dashboard/bookstore")).toEqual([]);
});

test("Settings picks how pages move, and keeps it", async ({ page }) => {
  await page.goto("/dashboard/settings");
  const motion = () => page.getByRole("radiogroup", { name: "Page turns" });
  await expect(motion().getByRole("radio", { name: "Page turn" })).toBeChecked();
  await motion().getByRole("radio", { name: "None" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "none");
  await page.reload();
  await expect(motion().getByRole("radio", { name: "None" })).toBeChecked();
});
