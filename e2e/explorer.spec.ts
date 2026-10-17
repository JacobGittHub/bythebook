import { expect, test } from "./fixtures/test";

test.describe("Explorer, as a guest", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/explorer");
    // The statistics are fetched from the browser, so once they show, the page is hydrated
    // and typing into it sticks.
    await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
  });

  test("fits its page, so neither the window nor the page scrolls", async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      // Every box that could scroll between the board and the book frame: the page's body,
      // and whatever holds the board on it.
      let pageDown = 0;
      for (let el = document.querySelector('[data-square="e2"]')?.parentElement; el && !el.classList.contains("book-frame"); el = el.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(el).overflowY)) pageDown = Math.max(pageDown, el.scrollHeight - el.clientHeight);
      }
      return {
        down: root.scrollHeight - root.clientHeight,
        across: root.scrollWidth - root.clientWidth,
        pageDown,
      };
    });
    expect(overflow.down).toBeLessThanOrEqual(0);
    expect(overflow.across).toBeLessThanOrEqual(0);
    expect(overflow.pageDown).toBeLessThanOrEqual(0);
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

test.describe("Explorer as a spread", () => {
  test.skip(({ isMobile }) => isMobile, "A phone gets the one-page form, which has no swap.");

  test("the book view swaps pages with the board, which keeps its game, and the button stays put", async ({ page }) => {
    await page.goto("/dashboard/explorer?line=e2e4,c7c5");
    await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
    const swap = page.getByRole("button", { name: "Swap with board" });
    const before = await swap.boundingBox();

    await swap.click();
    const back = page.getByRole("button", { name: "Swap back" });
    await expect(back).toBeVisible();
    // The board is still playable on the right page, at the same position.
    await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
    await page.locator('[data-square="g1"]').click();
    await page.locator('[data-square="f3"]').click();
    await expect(page.locator('[data-square="f3"] [data-piece="wN"]')).toBeVisible();
    const after = await back.boundingBox();
    expect(Math.abs(after!.x + after!.width - (before!.x + before!.width))).toBeLessThan(2);

    await back.click();
    await expect(page.getByRole("button", { name: "Swap with board" })).toBeVisible();
    await expect(page.locator('[data-square="f3"] [data-piece="wN"]')).toBeVisible();
    await expect(page.getByText("Labyrinth")).toBeVisible();
  });

  test("the scoresheet lists a picked line to its end, and goes to a move pressed on it", async ({ page }) => {
    await page.goto("/dashboard/explorer");
    await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
    await page.getByPlaceholder(/Search/).fill("Sicilian Defense: Najdorf");
    await page.getByRole("button", { name: /Najdorf/ }).first().click();

    const sheet = page.getByRole("complementary", { name: "Line" });
    await expect(sheet.getByRole("button", { name: "a6", exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Nf3", exact: true }).click();
    await expect(page.locator('[data-square="f3"] [data-piece="wN"]')).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Nf3", exact: true })).toHaveAttribute("aria-current", "step");
    await expect(sheet.getByText("ply 3")).toBeVisible();
  });
});

test("Explorer draws the chosen book, with the moves played past its end dashed", async ({ page }) => {
  await page.goto("/dashboard/bookstore/caro-kann-defense");
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText("In your library")).toBeVisible();

  await page.goto("/dashboard/explorer?line=e2e4,c7c6,d2d4,d7d5");
  await expect(page.locator('[data-square="d5"] [data-piece="bP"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Book", exact: true }).selectOption({ label: "Caro-Kann Defense (black)" });
  const head = page.locator(".book-running-head").first();
  await expect(head).toContainText("In book");
  await expect(page.getByRole("button", { name: "Book", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: "Spine and ribs of Caro-Kann Defense" })).toBeVisible();
  await expect(page.locator("svg .out")).toHaveCount(0);

  // a3 isn't in the book: the line leaves it there, dashed.
  await page.locator('[data-square="a2"]').click();
  await page.locator('[data-square="a3"]').click();
  await expect(head).toContainText("Out of book");
  await expect(page.locator("svg .out").first()).toBeAttached();

  // The switch on the view's header goes back to the explored line.
  await page.getByRole("button", { name: "Explored", exact: true }).click();
  await expect(page.getByRole("img", { name: "Spine and ribs of the explored line" })).toBeVisible();
});

test("Explorer opened at a position replays the line that reaches it", async ({ page }) => {
  // After 1. e4 c5, the Sicilian Defense.
  const fen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
  await page.goto(`/dashboard/explorer?fen=${encodeURIComponent(fen)}`);
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.locator('[data-square="c5"] [data-piece="bP"]')).toBeVisible();
  await expect(page.getByText("Exact line match")).toBeVisible();
});
