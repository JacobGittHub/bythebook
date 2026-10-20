import type { Page } from "@playwright/test";
import { visibleNavItems } from "@/lib/auth/access";
import { BOOK_WINDOW_SIZES, PHONE_MAX_WIDTH, chaptersFor, formFor, layoutBook, type Rect, type Size } from "@/lib/book/layout";
import { expect, test } from "./fixtures/test";

// The whole book at every listed window size (plans/book-ui.md Phase 4): each chapter's pages
// lie where the layout puts them (layout.ts), neither the window nor a page's body scrolls
// sideways, a board page's body never scrolls, and the page's bookmark or page tab meets its
// chapter. A desktop browser checks the desktops, laptops and tablets; a phone's, the phones.

/** How far a rendered box may lie from the layout's, for rounding. */
const SLACK = 1;

const chapters = visibleNavItems(false);

async function open(page: Page, size: Size, href: string) {
  await page.setViewportSize(size);
  await page.goto(href);
  // The server renders the last visit's form, until the script has the window's.
  await expect(page.locator(".book-frame")).toHaveAttribute("data-form", formFor(size));
  await page.evaluate(() => document.fonts.ready);
}

const box = (rect: { x: number; y: number; width: number; height: number }) =>
  `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`;
const near = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) <= SLACK && Math.abs(a.y - b.y) <= SLACK && Math.abs(a.width - b.width) <= SLACK && Math.abs(a.height - b.height) <= SLACK;

for (const [at, chapter] of chapters.entries()) {
  test(`${chapter.label} fits its pages at every listed window size`, async ({ page, isMobile }) => {
    const sizes = BOOK_WINDOW_SIZES.filter((size) => size.width < PHONE_MAX_WIDTH === isMobile);
    const wrong: string[] = [];
    for (const size of sizes) {
      const where = `${size.name} (${size.width}×${size.height})`;
      await open(page, size, chapter.href);
      const form = formFor(size);
      const layout = layoutBook({ window: size, form, at, pages: chapters.length, tabs: [], chapters: chaptersFor(size) });

      // A page's content may reach into its margins (a list's scrollbar does), but not past its edges.
      const pages = await page.locator(".book > .book-page").evaluateAll((els) =>
        els.map((el) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          const body = el.querySelector(".book-page-body");
          if (!body) return { x, y, width, height, scrolls: false, past: 0 };
          const left = body.getBoundingClientRect().left;
          return {
            x,
            y,
            width,
            height,
            scrolls: /auto|scroll/.test(getComputedStyle(body).overflowX) && body.scrollWidth > body.clientWidth,
            past: left + body.scrollWidth - (x + width),
          };
        }),
      );
      if (pages.length !== layout.pages.length) wrong.push(`${where}: ${pages.length} pages, not ${layout.pages.length}`);
      layout.pages.forEach((expected, i) => {
        const shown = pages[i];
        if (!shown) return;
        if (!near(shown, expected.rect)) wrong.push(`${where}: the ${expected.side} page is at ${box(shown)}, not ${box(expected.rect)}`);
        if (shown.scrolls) wrong.push(`${where}: the ${expected.side} page's body scrolls sideways`);
        if (shown.past > SLACK) wrong.push(`${where}: the ${expected.side} page's content reaches ${Math.round(shown.past)}px past its edge`);
      });

      const window = await page.evaluate(() => {
        const root = document.documentElement;
        return { down: root.scrollHeight - root.clientHeight, across: root.scrollWidth - root.clientWidth };
      });
      if (window.down > 0 || window.across > 0) wrong.push(`${where}: the window scrolls (${window.down}px down, ${window.across}px across)`);

      // A board page's body never scrolls: no box between the board and the frame does.
      const boardScrolls = await page.evaluate(() => {
        let most = 0;
        for (let el = document.querySelector('[data-square="e2"]')?.parentElement; el && !el.classList.contains("book-frame"); el = el.parentElement) {
          if (/auto|scroll/.test(getComputedStyle(el).overflowY)) most = Math.max(most, el.scrollHeight - el.clientHeight);
        }
        return most;
      });
      if (boardScrolls > 0) wrong.push(`${where}: the board's page scrolls by ${boardScrolls}px`);

      // The page's bookmark lies under its tab in the strip, or its page tab meets its chapter in the column.
      const tab = (await page
        .getByRole("navigation", { name: "Chapters" })
        .getByRole("link", { name: chapter.label, exact: true })
        .boundingBox())!;
      if (form === "spread") {
        const mark = page.locator(".book > .book-page .book-bookmark");
        await expect(mark).toHaveCount(1);
        const ribbon = (await mark.boundingBox())!;
        const middle = ribbon.x + ribbon.width / 2;
        if (middle < tab.x - SLACK || middle > tab.x + tab.width + SLACK) wrong.push(`${where}: the bookmark at ${Math.round(middle)} isn't under its tab ${box(tab)}`);
      } else {
        const ribbon = (await page.locator(".book > .book-page .book-page-tab").boundingBox())!;
        if (Math.abs(ribbon.x - (tab.x + tab.width)) > SLACK) wrong.push(`${where}: the page tab at ${box(ribbon)} doesn't meet its chapter ${box(tab)}`);
        if (Math.abs(ribbon.y + ribbon.height / 2 - (tab.y + tab.height / 2)) > SLACK) wrong.push(`${where}: the page tab isn't level with its chapter`);
      }
    }
    expect(wrong).toEqual([]);
  });
}
