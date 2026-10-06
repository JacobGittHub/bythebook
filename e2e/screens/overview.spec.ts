import { expect, test } from "../fixtures/test";

test("Overview, as a guest", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveScreenshot("overview.png", { fullPage: true });
});
