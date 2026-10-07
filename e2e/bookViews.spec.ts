import { expect, test } from "./fixtures/test";

test.describe("Small visualizations, as a guest", () => {
  test("draw an example book with its credit, and switch views and books", async ({ page }) => {
    await page.goto("/dashboard/visualizations/books/spine");
    await expect(page.getByRole("img", { name: "Spine and ribs of Queen's Gambit" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Wikibooks contributors/ })).toBeVisible();

    await page.getByRole("radio", { name: "Metro map" }).click();
    await expect(page.getByRole("heading", { name: "Metro map" })).toBeVisible();
    await expect(page).toHaveURL(/\/books\/metro\?book=example%3Aqueens-gambit$/);

    await page.getByLabel("Book", { exact: true }).selectOption("example:french-defense");
    await expect(page.getByRole("img", { name: "Metro map of French Defense" })).toBeVisible();
  });

  test("select a clicked position and show it on the board", async ({ page }) => {
    await page.goto("/dashboard/visualizations/books/ply-columns");
    await page.locator('[data-move="1...d5"]').click();
    // While the pointer is on the position the panel previews it; away from it, it is selected.
    await expect(page.getByText("Preview", { exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByText("Selected", { exact: true })).toBeVisible();
    await expect(page.locator('[data-square="d5"] [data-piece="bP"]')).toBeVisible();
  });
});

test.describe("Explorer's tree window, as a guest", () => {
  test("opens on spine and ribs, switches views, and plays a clicked move", async ({ page }) => {
    await page.goto("/dashboard/explorer");
    await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Spine and ribs" })).toBeChecked();

    await page.locator('[data-move="1.e4"]').click();
    await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();

    await page.getByRole("radio", { name: "Icicle" }).click();
    await expect(page.getByRole("img", { name: "Icicle of the explored line" })).toBeVisible();
    // The choice is kept for the next visit.
    await page.reload();
    await expect(page.getByRole("radio", { name: "Icicle" })).toBeChecked();
  });
});
