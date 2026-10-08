import { expect, test } from "./fixtures/test";

// A guest's library, kept in the browser's IndexedDB (plans/deployment.md D12, D23). Every
// test starts in a fresh browser, so its library starts empty and never touches the user's.

const LIBRARY = "/dashboard/library";

async function openLibrary(page: import("@playwright/test").Page) {
  await page.goto(LIBRARY);
  await expect(page.getByText("Kept in this browser", { exact: true })).toBeVisible();
}

async function createBook(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "+ New book" }).click();
  await page.getByPlaceholder(/Ruy Lopez/).fill(name);
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

test.describe("Library, as a guest", () => {
  test("keeps a new book in this browser through a reload, and deletes it", async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByText("No opening books yet.")).toBeVisible();
    await createBook(page, "My Najdorf");

    await page.reload();
    await expect(page.getByRole("heading", { name: "My Najdorf", level: 3 })).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No opening books yet.")).toBeVisible();
  });

  test("saves an example book with its publisher", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "Save King's Gambit" }).click();
    await expect(page.getByRole("heading", { name: "King's Gambit", level: 3 })).toBeVisible();
    await expect(page.getByText("From ByTheBook")).toBeVisible();
  });

  test("adds a line from the Explorer", async ({ page }) => {
    await openLibrary(page);
    await createBook(page, "Queen's pawn");

    await page.goto("/dashboard/explorer");
    await page.getByRole("combobox", { name: "Book", exact: true }).selectOption({ label: "Queen's pawn (white)" });
    await page.getByRole("button", { name: /^d4 White/ }).click();
    await page.getByRole("button", { name: /^Add line/ }).click();
    await expect(page.getByRole("button", { name: /^Add line/ })).toBeEnabled();

    await openLibrary(page);
    await expect(page.getByText("1 line", { exact: true })).toBeVisible();
    await expect(page.getByText("1 position", { exact: true })).toBeVisible();
  });

  test("backs up to a file that restores in another browser", async ({ page, browser }) => {
    await openLibrary(page);
    await createBook(page, "Backed up");
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
      await expect(fresh.getByText("No opening books yet.")).toBeVisible();
      await fresh.getByLabel("Backup file to restore").setInputFiles(file);
      await fresh.getByRole("button", { name: "Restore 1 book" }).click();
      await fresh.getByRole("button", { name: "Done" }).click();
      await expect(fresh.getByRole("heading", { name: "Backed up", level: 3 })).toBeVisible();
    } finally {
      await other.close();
    }
  });
});
