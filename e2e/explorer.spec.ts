import { expect, test } from "./fixtures/test";

test.describe("Explorer, as a guest", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/explorer");
    // The statistics are fetched from the browser, so once they show, the page is hydrated
    // and typing into it sticks.
    await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
  });

  test("fits the viewport, so the page itself never scrolls", async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        down: root.scrollHeight - root.clientHeight,
        across: root.scrollWidth - root.clientWidth,
      };
    });
    expect(overflow.down).toBeLessThanOrEqual(0);
    expect(overflow.across).toBeLessThanOrEqual(0);
  });

  test("plays a move clicked on the board, and takes it back", async ({ page }) => {
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "e4", exact: true }).first()).toBeVisible();

    await page.getByTitle("Undo move").click();
    await expect(page.locator('[data-square="e2"] [data-piece="wP"]')).toBeVisible();
    await expect(page.getByText("No moves yet.")).toBeVisible();
  });

  test("shows master statistics and plays a move picked from them", async ({ page }) => {
    await page.getByRole("button", { name: /^d4 White/ }).click();
    await expect(page.locator('[data-square="d4"] [data-piece="wP"]')).toBeVisible();
  });

  test("steps through a line found by search", async ({ page }) => {
    await page.getByPlaceholder(/Search/).fill("Sicilian Defense");
    await page.getByRole("button", { name: /Sicilian Defense/ }).first().click();

    await page.getByTitle("Step forward").click();
    await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();

    await page.getByTitle("Go to end").click();
    await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
    await expect(page.getByTitle("Step forward")).toBeDisabled();

    await page.getByTitle("Go to start").click();
    await expect(page.locator('[data-square="e2"] [data-piece="wP"]')).toBeVisible();
    // The line stays highlighted, so it can be stepped through again.
    await expect(page.getByTitle("Step forward")).toBeEnabled();
  });

  test("autoplays a highlighted line to its end", async ({ page }) => {
    await page.getByPlaceholder(/Search/).fill("Sicilian Defense");
    await page.getByRole("button", { name: /Sicilian Defense/ }).first().click();

    await page.getByTitle("Play").click();
    await expect(page.getByTitle("Pause")).toBeVisible();
    await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
    await expect(page.getByTitle("Play")).toBeVisible();
    await expect(page.getByTitle("Step forward")).toBeDisabled();
  });
});

test("Explorer opened at a position replays the line that reaches it", async ({ page }) => {
  // After 1. e4 c5, the Sicilian Defense.
  const fen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
  await page.goto(`/dashboard/explorer?fen=${encodeURIComponent(fen)}`);
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
  await expect(page.getByText("Exact line match")).toBeVisible();
});
