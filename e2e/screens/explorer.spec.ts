import { expect, test } from "../fixtures/test";

test("Explorer at the start position, as a guest", async ({ page }) => {
  await page.goto("/dashboard/explorer");
  // The statistics come from the fixtures; once they show, the page has settled.
  await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-start.png");
});
