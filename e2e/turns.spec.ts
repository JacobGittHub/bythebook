import type { Page } from "@playwright/test";
import { MOTION_STORAGE_KEY, type Motion } from "@/lib/appearance";
import { expect, test } from "./fixtures/test";

// The book's moves between chapters (plans/book-ui.md D13, D14): page turns, or none. A move is
// recorded as the browser starts its animations: each animation's name and the picture it moves.

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
        transition.ready.then(
          () =>
            window.__moves.push(
              document
                .getAnimations()
                .filter((a) => a instanceof CSSAnimation && (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"))
                .map((a) => `${(a as CSSAnimation).animationName} ${(a.effect as KeyframeEffect).pseudoElement}`),
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
  const before = await page.evaluate(() => window.__moves.length);
  await page.getByRole("navigation", { name: "Chapters" }).getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  // Under None no transition starts, so there is nothing to wait for.
  await page.waitForTimeout(300);
  const moves = await page.evaluate(() => window.__moves);
  return moves.length > before ? moves[moves.length - 1] : [];
}

const form = (page: Page) => page.locator(".book-frame").getAttribute("data-form");
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

test("None: pages change at once", async ({ page }) => {
  await recordMoves(page, "none");
  await page.goto("/dashboard/library");
  expect(await moveTo(page, "Bookstore", "/dashboard/bookstore")).toEqual([]);
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
