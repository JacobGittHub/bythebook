import { BOOK_WINDOW_SIZES, SPREAD_MIN_WIDTH } from "@/lib/book/layout";
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
    await expect(bookList(page).getByRole("link", { name: /My Sicilian/ })).toBeVisible();
    await expect(page.getByText("6 / 1,000")).toBeVisible();

    await page.getByRole("button", { name: "More for My Sicilian" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("dialog", { name: "Rename book" }).getByLabel("Name").fill("Open Sicilian");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Open Sicilian", level: 2 })).toBeVisible();

    // On its own page the book opens down its main line, at 3.d4; removing it leaves five positions.
    await page.getByRole("link", { name: "Open book page" }).click();
    await page.getByRole("button", { name: "Remove move" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Remove 3.d4?");
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("5 / 1,000")).toBeVisible();

    await page.getByRole("button", { name: "More for Open Sicilian" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/dashboard\/library$/);
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
    await expect(bookList(page).getByRole("link", { name: "Queen's pawn 1 position" })).toBeVisible();
  });

  test("saves a Bookstore book from the empty Library, with its publisher", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "Save King's Gambit" }).click();
    await expect(page.getByRole("heading", { name: "King's Gambit", level: 2 })).toBeVisible();
    await expect(page.getByText("Saved from the Bookstore, published by ByTheBook.", { exact: false })).toBeVisible();
    await expect(page.getByRole("region", { name: "King's Gambit" }).getByText("Verified")).toBeVisible();
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
      await expect(bookList(fresh).getByRole("link", { name: /Backed up/ })).toBeVisible();
    } finally {
      await other.close();
    }
  });
});

// The Library as a spread (plans/book-ui.md D8): the books on the left page, the picked one on
// the right, and a book's own page as the second level, with the books beside it.
test.describe("Library as a spread, as a guest", () => {
  test("a book's row picks it on the right page, and the folios count the books", async ({ page }) => {
    await openLibrary(page);
    await createPastedBook(page, "First book");
    await createPastedBook(page, "Second book", "1. e4 e5");
    await bookList(page).getByRole("link", { name: /First book/ }).click();
    await expect(page.getByRole("heading", { name: "First book", level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/library\?book=/);
    await expect(bookList(page).getByRole("link", { name: /First book/ })).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".book-folio", { hasText: "2 books" })).toContainText("5 positions in all");
    // The picked row reaches past the text into the room kept for it, and nothing on the
    // list's page scrolls sideways for it.
    const sideways = await page.locator('[data-slot="page"]:not([data-side="right"])').evaluate((pageEl) =>
      [pageEl, ...pageEl.querySelectorAll("*")].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth).length,
    );
    expect(sideways).toBe(0);
  });

  test("a book's page lists the books, to switch between them and go back", async ({ page }) => {
    await openLibrary(page);
    await createPastedBook(page, "First book");
    await createPastedBook(page, "Second book", "1. e4 e5");
    await page.getByRole("link", { name: "Open book page" }).click();
    await expect(page.getByRole("heading", { name: "Second book", level: 1 })).toBeVisible();
    await expect(page.locator(".book-folio", { hasText: /^Book \d/ })).toHaveText("Book 1 of 2");

    await bookList(page).getByRole("link", { name: /First book/ }).click();
    await expect(page.getByRole("heading", { name: "First book", level: 1 })).toBeVisible();
    await expect(page.locator(".book-folio", { hasText: /^Book \d/ })).toHaveText("Book 2 of 2");

    await page.getByRole("link", { name: "Back to all books" }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\?book=/);
    await expect(page.getByRole("heading", { name: "Your books", level: 1 })).toBeVisible();
    // Back with the book it was on picked, not the first one.
    await expect(bookList(page).locator('[aria-current="true"]')).toContainText("First book");
  });

  test("a book's page fits its first screen at every spread window size, with what lies below in sight", async ({ page }) => {
    await openLibrary(page);
    await createPastedBook(page, "Fitted book");
    await page.getByRole("link", { name: "Open book page" }).click();
    await expect(page.getByRole("heading", { name: "Fitted book", level: 1 })).toBeVisible();
    const right = page.locator('[data-slot="page"][data-side="right"]');
    for (const size of BOOK_WINDOW_SIZES.filter((size) => size.width >= SPREAD_MIN_WIDTH)) {
      await page.setViewportSize(size);
      await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "spread");
      for (const part of [".book-fold", ".book-page-body"]) {
        const overflow = await right.locator(part).evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(overflow, `${size.name}: ${part}`).toBeLessThanOrEqual(0);
      }
      // The first screen ends above the window's bottom, and the top of what lies below shows.
      const fold = await right.locator(".book-fold").evaluate((el) => el.getBoundingClientRect().bottom);
      const below = await page.getByRole("heading", { name: "About this book" }).evaluate((el) => el.getBoundingClientRect().top);
      expect(fold, size.name).toBeLessThan(size.height);
      expect(below, size.name).toBeLessThan(size.height);
    }
  });

  test("on a phone, where the halves stack, a book's row opens its page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLibrary(page);
    await createPastedBook(page, "Phone book");
    await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "single");
    await bookList(page).getByRole("link", { name: /Phone book/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Phone book", level: 1 })).toBeVisible();
  });

  test("the chapter column gives the Library's book count", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openLibrary(page);
    await createPastedBook(page, "Counted book");
    const library = page.getByRole("navigation", { name: "Chapters" }).getByRole("link", { name: "Library" });
    await expect(library).toContainText("1");
  });
});
