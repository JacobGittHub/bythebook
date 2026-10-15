import type { Page } from "@playwright/test";
import { VIBES_CHAPTER, bookContents } from "@/lib/auth/access";
import { roman } from "@/lib/book/chapters";
import { BOOK_WINDOW_SIZES, SPREAD_MIN_WIDTH } from "@/lib/book/layout";
import { expect, test } from "./fixtures/test";

// The Overview as a spread (plans/book-ui.md D10): the book's contents on the left page, the
// picked chapter on the right.

const contents = (page: Page) => page.getByRole("list", { name: "Contents" });

test.describe("Overview, as a guest", () => {
  test("lists the book's chapters in order and numbered, with Vibes coming soon", async ({ page }) => {
    await page.goto("/dashboard");
    const entries = bookContents(false);
    const rows = contents(page).getByRole("listitem");
    await expect(rows).toHaveCount(entries.length);
    for (const [i, entry] of entries.entries()) {
      await expect(rows.nth(i)).toContainText(`${roman(i + 1)}${entry.label}`);
    }
    await expect(rows.nth(entries.indexOf(VIBES_CHAPTER))).toContainText("Soon");
  });

  test("the first press shows a chapter, and the second goes to its page", async ({ page }) => {
    await page.goto("/dashboard");
    const entries = bookContents(false);
    const number = entries.findIndex((entry) => entry.label === "Library") + 1;
    const library = entries[number - 1];

    await contents(page).getByRole("link", { name: "Show Library" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Library" })).toBeVisible();
    await expect(page.getByText(library.details!)).toBeVisible();
    await expect(page.getByText(`Chapter ${roman(number)}`, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    await contents(page).getByRole("link", { name: "Jump to Library" }).click();
    await expect(page).toHaveURL(/\/dashboard\/library$/);
  });

  test("the shown chapter's Jump to page tag goes at once", async ({ page }) => {
    await page.goto("/dashboard");
    await contents(page).getByRole("link", { name: "Show Bookstore" }).click();
    await page.getByRole("link", { name: "Jump to page" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bookstore$/);
  });

  test("the Vibes chapter shows, with no page to jump to", async ({ page }) => {
    await page.goto("/dashboard");
    const vibes = contents(page).getByRole("button", { name: "Show Vibes" });
    await vibes.click();
    await expect(page.getByRole("heading", { level: 2, name: "Vibes" })).toBeVisible();
    await expect(page.getByText(VIBES_CHAPTER.details!)).toBeVisible();
    await expect(page.getByRole("link", { name: "Jump to page" })).toHaveCount(0);
    await vibes.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("on a phone, where the chapter is below the contents, a press brings it into view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "single");
    await contents(page).getByRole("link", { name: "Show Settings" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeInViewport();
  });

  test("says what an account adds, and how to get one", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 2, name: "What an account adds" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Your books" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  });

  test("the folios number the chapters as the contents do", async ({ page }) => {
    const entries = bookContents(false);
    const settings = entries.findIndex((entry) => entry.href === "/dashboard/settings") + 1;
    await page.goto("/dashboard/settings");
    await expect(page.locator(".book-folio", { hasText: "Chapter" })).toHaveText(`Chapter ${roman(settings)} of ${roman(entries.length)}`);
  });

  test("never scrolls sideways", async ({ page }) => {
    await page.goto("/dashboard");
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
  });

  test("the contents fit the left page at every spread window size", async ({ page }) => {
    await page.goto("/dashboard");
    for (const size of BOOK_WINDOW_SIZES.filter((size) => size.width >= SPREAD_MIN_WIDTH)) {
      await page.setViewportSize(size);
      await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "spread");
      const overflow = await page.locator(".overview-contents").evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow, size.name).toBeLessThanOrEqual(0);
    }
  });
});
