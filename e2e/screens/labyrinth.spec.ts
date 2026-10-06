import { ACCOUNT_STATE, NO_ACCOUNT_REASON, testAccount } from "../fixtures/account";
import { LABYRINTH, waitForSettledMap, zoomAt } from "../fixtures/labyrinth";
import { expect, test } from "../fixtures/test";

// The Labyrinth is the priority for screenshots (plans/testing.md, D8). Fixture data and
// its seeded layout draw the same map every run.
test.describe("Labyrinth screenshots", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.use({ storageState: ACCOUNT_STATE });

  for (const size of [
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "phone", viewport: { width: 390, height: 844 } },
  ]) {
    test.describe(size.name, () => {
      test.use({ viewport: size.viewport });

      test("the start position", async ({ page }) => {
        await page.goto(LABYRINTH);
        await waitForSettledMap(page);
        await expect(page).toHaveScreenshot(`start-${size.name}.png`);
      });

      test("zoomed into the centre", async ({ page }) => {
        await page.goto(LABYRINTH);
        await waitForSettledMap(page);
        await zoomAt(page, 15);
        await waitForSettledMap(page);
        await expect(page).toHaveScreenshot(`zoomed-${size.name}.png`);
      });
    });
  }
});
