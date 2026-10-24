import path from "node:path";
import { ACCOUNT_STATE, NO_ACCOUNT_REASON, testAccount } from "./fixtures/account";
import { LIBRARY } from "./fixtures/library";
import { expect, test } from "./fixtures/test";

// A guest's game import (plans/game-history.md D29): the dialog, then the import at the bottom
// of the Library's left page, carrying on across pages with a toast where it ends. Every test
// starts in a fresh browser, so its history starts empty. The first test is also the check that
// the import's worker loads under Turbopack.
// An account's import is the same dialog, its games staged and committed through `/api/history`.

const FIXTURE = path.join(__dirname, "..", "src", "lib", "history", "fixtures", "chesscom.pgn");

/** A PGN file of `count` short games that "Me" played, each against a different player. */
function clubFile(count: number): Buffer {
  const games = Array.from(
    { length: count },
    (_, i) => `[Event "Club"]\n[Date "2025.01.01"]\n[White "Me"]\n[Black "Rival${i}"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0\n`,
  );
  return Buffer.from(games.join("\n"));
}

test.describe("Game import, as a guest", () => {
  test("a file is checked, imported on the Library's page and kept through a reload", async ({ page }) => {
    await page.goto(LIBRARY);
    const history = page.getByRole("region", { name: "Game history" });
    await history.getByRole("button", { name: "Import games" }).click();
    await page.getByRole("dialog", { name: "Import your games" }).getByLabel("PGN file to import").setInputFiles(FIXTURE);

    const check = page.getByRole("dialog", { name: "Check the file" });
    await expect(check.getByLabel("Which player are you?")).toHaveValue("FixturePlayer");
    await check.getByRole("button", { name: "Import 17 games" }).click();
    await expect(check).toBeHidden();
    await expect(history.getByRole("heading", { name: "Imported 17 games" })).toBeVisible();
    await expect(history.getByRole("link", { name: "Open game history" })).toBeVisible();

    await page.reload();
    await expect(history.getByText("17 games")).toBeVisible();

    // The history page shows them, walked with the arrow keys and chosen by side (D30, D32, D38).
    await history.getByRole("link", { name: "Open game history" }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\/history$/);
    await expect(page.getByRole("img", { name: "Ply columns of your games" })).toBeVisible();
    // The arrow keys walk the tree from anywhere on the page, not only once it has the focus.
    await page.getByRole("heading", { name: "All games" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { name: /^Games through 1\./ })).toBeVisible();
    await page.getByRole("radio", { name: "Black" }).click();
    await expect(page.getByRole("button", { name: "All games" })).toBeVisible();
  });

  test("an import carries on across pages, and a toast with a close button reports it", async ({ page }) => {
    await page.goto(LIBRARY);
    const history = page.getByRole("region", { name: "Game history" });
    await history.getByRole("button", { name: "Import games" }).click();
    await page
      .getByRole("dialog", { name: "Import your games" })
      .getByLabel("PGN file to import")
      .setInputFiles({ name: "club.pgn", mimeType: "text/plain", buffer: clubFile(5_000) });
    await page.getByRole("dialog", { name: "Check the file" }).getByRole("button", { name: "Import 5,000 games" }).click();
    await expect(history.getByRole("heading", { name: "Importing games" })).toBeVisible();

    await page.getByRole("navigation", { name: "Chapters" }).getByRole("link", { name: "Explorer", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/explorer/);
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Imported 5,000 games" });
    await expect(toast).toBeVisible({ timeout: 60_000 });
    await toast.getByRole("button", { name: "Close toast" }).click();
    await expect(toast).toBeHidden();
  });
});

test.describe("Game import, signed in", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "It writes to the live database; one browser is enough.");
  test.use({ storageState: ACCOUNT_STATE });

  // The test account's history starts and ends empty.
  test.beforeEach(async ({ page }) => {
    expect((await page.request.delete("/api/history")).ok()).toBe(true);
  });
  test.afterEach(async ({ page }) => {
    await page.request.delete("/api/history");
  });

  test("a file is staged and committed to the account, kept through a reload, then deleted", async ({ page }) => {
    await page.goto(LIBRARY);
    const history = page.getByRole("region", { name: "Game history" });
    await history.getByRole("button", { name: "Import games" }).click();
    await page.getByRole("dialog", { name: "Import your games" }).getByLabel("PGN file to import").setInputFiles(FIXTURE);
    await page.getByRole("dialog", { name: "Check the file" }).getByRole("button", { name: "Import 17 games" }).click();
    await expect(history.getByRole("heading", { name: "Imported 17 games" })).toBeVisible();

    await page.reload();
    await expect(history.getByText("17 games")).toBeVisible();
    await expect(history.getByText(/kept in your account/)).toBeVisible();

    await history.getByRole("button", { name: "More for game history" }).click();
    await page.getByRole("menuitem", { name: "Delete all games" }).click();
    await page.getByRole("alertdialog", { name: "Delete all 17 games?" }).getByRole("button", { name: "Delete all" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Deleted 17 games." })).toBeVisible();
    await expect(history.getByText(/Import your games from Chess.com/)).toBeVisible();
  });
});
