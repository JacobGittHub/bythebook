import { visibleNavItems } from "@/lib/auth/access";
import { expect, test } from "./fixtures/test";

test.describe("Overview, as a guest", () => {
  test("introduces the app and says the visitor is a guest", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: "Learn openings as places, not move lists" }),
    ).toBeVisible();
    await expect(page.getByText("You are browsing as a guest")).toBeVisible();
  });

  test("describes every page a guest can reach", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    for (const item of visibleNavItems(false).filter((item) => item.details)) {
      await expect(main.getByText(item.details!)).toBeAttached();
    }
  });

  test("never scrolls sideways", async ({ page }) => {
    await page.goto("/dashboard");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
