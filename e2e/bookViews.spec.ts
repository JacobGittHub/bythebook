import { expect, test } from "./fixtures/test";

test.describe("Small visualizations, as a guest", () => {
  test("draw an example book with its credit, and switch books and views", async ({ page, isMobile }) => {
    await page.goto("/dashboard/visualizations/books/spine");
    await expect(page.getByRole("img", { name: "Spine and ribs of Queen's Gambit" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Wikibooks contributors/ })).toBeVisible();

    await page.getByLabel("Book", { exact: true }).selectOption("example:french-defense");
    await expect(page.getByRole("img", { name: "Spine and ribs of French Defense" })).toBeVisible();
    await expect(page).toHaveURL(/\/books\/spine\?book=example%3Afrench-defense$/);

    // Another view keeps the book: from the list on the left page, or on one page from the menu.
    if (isMobile) await page.getByLabel("View", { exact: true }).selectOption("metro");
    else await page.getByRole("link", { name: /^Metro map/ }).click();
    await expect(page.getByRole("heading", { name: "Metro map", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/books\/metro\?book=example%3Afrench-defense$/);
    await expect(page.getByRole("img", { name: "Metro map of French Defense" })).toBeVisible();
  });

  test("select a clicked position and show it on the board", async ({ page }) => {
    await page.goto("/dashboard/visualizations/books/ply-columns");
    const move = page.locator('[data-move="1...d5"]');
    await move.click();
    // While the pointer is on the position the panel previews it; away from it, it is selected.
    // The view pans to keep a selection in view, so the pointer goes back to where it moved.
    await move.hover();
    await expect(page.getByText("Preview", { exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByText("Selected", { exact: true })).toBeVisible();
    await expect(page.locator('[data-square="d5"] [data-piece="bP"]')).toBeVisible();
  });

  test("walk with the arrow keys, back onto the move they came from", async ({ page }) => {
    await page.goto("/dashboard/visualizations/books/ply-columns");
    await page.locator('[data-move="1...d5"]').click();
    await page.mouse.move(0, 0);
    const blackPawn = page.locator('[data-square="d5"] [data-piece="bP"]');
    await expect(blackPawn).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(blackPawn).toHaveCount(0);
    await expect(page.locator('[data-square="d4"] [data-piece="wP"]')).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(blackPawn).toBeVisible();
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
