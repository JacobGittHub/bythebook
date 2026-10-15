import type { Page } from "@playwright/test";
import { CHAPTER_NAMES_MIN_WIDTH, SPREAD_MIN_WIDTH } from "@/lib/book/layout";
import { expect, test } from "./fixtures/test";

// The book frame's one-page form (plans/book-ui.md D15): its chapter column, its page tab and
// its second levels. A tablet's window is set in each test, since every project's own is a
// desktop's (the spread) or a phone's.

const TABLET = { width: 1024, height: 768 };
const PHONE = { width: 390, height: 844 };

const chapters = (page: Page) => page.getByRole("navigation", { name: "Chapters" });
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test("the one-page form's chapter column narrows to icons and widens again, and keeps the pick", async ({ page }) => {
  expect(TABLET.width).toBeLessThan(SPREAD_MIN_WIDTH);
  expect(TABLET.width).toBeGreaterThanOrEqual(CHAPTER_NAMES_MIN_WIDTH);
  await page.setViewportSize(TABLET);
  await page.goto("/dashboard/library");
  const name = chapters(page).getByText("Bookstore", { exact: true });
  await expect(name).toBeVisible();

  await page.getByRole("button", { name: "Narrow the chapters to icons" }).click();
  await expect(name).toBeHidden();
  // The page moves over with the column, and its tab still meets its chapter.
  const tab = await box(page, ".book-page-tab");
  const row = (await chapters(page).getByRole("link", { name: "Library", exact: true }).boundingBox())!;
  expect(Math.abs(tab.x - (row.x + row.width))).toBeLessThanOrEqual(1);

  await page.reload();
  await expect(name).toBeHidden();
  await page.getByRole("button", { name: "Widen the chapters to names" }).click();
  await expect(name).toBeVisible();
});

test("on a phone the page tab meets its chapter, short of the page's text", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/dashboard/bookstore");
  await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "single");
  // A phone has no button to widen its icons.
  await expect(page.locator(".book-chapters-toggle")).toBeHidden();

  const tab = await box(page, ".book-page-tab");
  const row = (await chapters(page).getByRole("link", { name: "Bookstore", exact: true }).boundingBox())!;
  const body = await box(page, ".book-page-body");
  expect(Math.abs(tab.x - (row.x + row.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(tab.y + tab.height / 2 - (row.y + row.height / 2))).toBeLessThanOrEqual(1);
  expect(tab.x + tab.width).toBeLessThan(body.x);
});

test("a second level in the one-page form shows its own page, with the way back in its running head", async ({ page }) => {
  await page.setViewportSize(TABLET);
  await page.goto("/dashboard/bookstore");
  const link = page.locator('a[href^="/dashboard/bookstore/"]').first();
  const href = (await link.getAttribute("href"))!;
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));

  const back = page.locator(".book-running-head").getByRole("link", { name: "Back to Bookstore" });
  await expect(back).toBeVisible();
  // The Bookstore's tab stays lit.
  await expect(chapters(page).getByRole("link", { name: "Bookstore", exact: true })).toHaveAttribute("aria-current", "page");
  await back.click();
  await expect(page).toHaveURL(/\/dashboard\/bookstore$/);
});
