import { expect, test } from "./fixtures/test";

// The Visualizations chapter (plans/book-ui.md D18): its own page lists the visualizations as
// contents, and each opens on a page of its own, a second level.
test.describe("Visualizations, as a guest", () => {
  test("a first press shows a visualization, and a second opens its page", async ({ page }) => {
    await page.goto("/dashboard/visualizations");
    const treemap = page.getByRole("link", { name: /^Treemap/ });
    await treemap.click();
    await expect(page.getByRole("heading", { name: "Treemap", level: 2 })).toBeVisible();
    await expect(page.getByRole("img", { name: "Treemap, a screenshot" }).first()).toBeAttached();
    await expect(page).toHaveURL(/\/dashboard\/visualizations$/);

    await treemap.click();
    await expect(page).toHaveURL(/\/dashboard\/visualizations\/treemap$/);
    await expect(page.getByLabel("Search openings")).toBeVisible();
  });

  test("a visualization that needs an account is shown, with a sign-in offer in place of the jump", async ({ page }) => {
    await page.goto("/dashboard/visualizations");
    await page.getByRole("button", { name: "Show Globe" }).click();
    await expect(page.getByRole("heading", { name: "Globe", level: 2 })).toBeVisible();
    await expect(page.getByText("to open the Globe.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Jump to page" })).toHaveCount(0);
  });
});

test.describe("A visualization's page, as a guest", () => {
  test.skip(({ isMobile }) => isMobile, "A phone shows a second level's own page only, without the list.");

  test("lists the others beside it, and goes back with it picked", async ({ page }) => {
    await page.goto("/dashboard/visualizations/treemap");
    const list = page.getByRole("region", { name: "Opening tree" });
    await expect(list.getByRole("link", { name: /^Treemap/ })).toHaveAttribute("aria-current", "true");

    await page.getByRole("link", { name: "Back to all visualizations" }).click();
    await expect(page).toHaveURL(/\/dashboard\/visualizations\?show=treemap$/);
    await expect(page.getByRole("heading", { name: "Treemap", level: 2 })).toBeVisible();
  });
});
