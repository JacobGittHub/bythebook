import { LIBRARY, bookList, createPastedBook } from "./fixtures/library";
import { expect, test } from "./fixtures/test";

// A guest's library, kept in the browser's IndexedDB (plans/deployment.md D12, D21–D25). Every
// test starts in a fresh browser, so its library starts empty and never touches the user's.

async function openLibrary(page: import("@playwright/test").Page) {
  await page.goto(LIBRARY);
  await expect(page.getByText("Kept in this browser", { exact: true })).toBeVisible();
}

test.describe("Library, as a guest", () => {
  test("a pasted book keeps through a reload, and is renamed, edited and deleted", async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
    await createPastedBook(page, "My Sicilian", "1. e4 c5 2. Nf3 d6 (2... Nc6) 3. d4");

    await page.reload();
    await expect(bookList(page).getByRole("button", { name: /My Sicilian/ })).toBeVisible();
    await expect(page.getByText("6 / 1,000")).toBeVisible();

    await page.getByRole("button", { name: "More for My Sicilian" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("dialog", { name: "Rename book" }).getByLabel("Name").fill("Open Sicilian");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Open Sicilian", level: 2 })).toBeVisible();

    // The book opens down its main line, at 3.d4; removing it leaves five positions.
    await page.getByRole("button", { name: "Remove move" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Remove 3.d4?");
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("5 / 1,000")).toBeVisible();

    await page.getByRole("button", { name: "More for Open Sicilian" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
  });

  test("a book has its own page, with the five views and zoom", async ({ page }) => {
    await openLibrary(page);
    await createPastedBook(page, "Queen's pawn");
    await page.getByRole("link", { name: "Open book page" }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Queen's pawn", level: 1 })).toBeVisible();
    await page.getByRole("radio", { name: "Metro map" }).click();
    await expect(page.getByRole("img", { name: "Metro map of Queen's pawn" })).toBeVisible();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByRole("button", { name: "Fit" })).toHaveText("1.5×");
    await expect(page.getByText("Your book", { exact: true })).toBeVisible();
  });

  test("New book opens the Explorer with the book chosen, and a line added there shows", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New book" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New book" });
    await dialog.getByLabel("Name").fill("Queen's pawn");
    await dialog.getByRole("button", { name: /Create and open the Explorer/ }).click();

    await expect(page).toHaveURL(/\/dashboard\/explorer\?book=/);
    await expect(page.getByRole("combobox", { name: "Book", exact: true })).toHaveValue(/.+/);
    await page.getByRole("button", { name: /^d4 White/ }).click();
    await page.getByRole("button", { name: /^Add line/ }).click();
    await expect(page.getByRole("button", { name: /^Add line/ })).toBeEnabled();

    await openLibrary(page);
    await expect(bookList(page).getByText("1 position", { exact: true })).toBeVisible();
  });

  test("saves a Bookstore book from the empty Library, with its publisher", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "Save King's Gambit" }).click();
    await expect(page.getByRole("heading", { name: "King's Gambit", level: 2 })).toBeVisible();
    await expect(page.getByText("Saved from the Bookstore, published by ByTheBook.", { exact: false })).toBeVisible();
    await expect(bookList(page).getByText("Verified")).toBeVisible();
  });

  test("backs up to a file that restores in another browser", async ({ page, browser }) => {
    await openLibrary(page);
    await createPastedBook(page, "Backed up");
    await expect(page.getByText(/haven.t been backed up yet/)).toBeVisible();

    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Back up", exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^bythebook-library-\d{4}-\d{2}-\d{2}\.json$/);
    const file = test.info().outputPath("backup.json");
    await download.saveAs(file);
    // A headless browser makes no promise to keep the data, so the notice stays, with the date.
    await expect(page.getByText(/^Last backed up .+\. This browser hasn.t promised/)).toBeVisible();

    const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const fresh = await other.newPage();
      await openLibrary(fresh);
      await expect(fresh.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
      await fresh.getByLabel("Backup file to restore").setInputFiles(file);
      await fresh.getByRole("button", { name: "Restore 1 book" }).click();
      await fresh.getByRole("button", { name: "Done" }).click();
      await expect(bookList(fresh).getByRole("button", { name: /Backed up/ })).toBeVisible();
    } finally {
      await other.close();
    }
  });
});
