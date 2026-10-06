import { ACCOUNT_STATE, NO_ACCOUNT_REASON, testAccount } from "./fixtures/account";
import { LABYRINTH, labyrinthCanvas, waitForSettledMap, zoomAt } from "./fixtures/labyrinth";
import { expect, test } from "./fixtures/test";

test.describe("Labyrinth, signed in", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.use({ storageState: ACCOUNT_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto(LABYRINTH);
    await expect(labyrinthCanvas(page)).toBeVisible();
  });

  test("lays out the map from the start position", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Starting position" })).toBeVisible();
    await expect(page.getByText("Laying out the map…")).toBeHidden({ timeout: 30_000 });
    await waitForSettledMap(page);
  });

  test("zooming into a move takes the view inside it", async ({ page }) => {
    await waitForSettledMap(page);
    await zoomAt(page, 25);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Starting position", {
      timeout: 30_000,
    });
    // The line under the title names the move the view is inside.
    await expect(page.locator("h1 + p span.font-mono")).toHaveText(/^1\. /);
  });

  test("fits the viewport, so the page itself never scrolls", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
