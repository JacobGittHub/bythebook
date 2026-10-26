import { BOOK_WINDOW_SIZES, SPREAD_MIN_WIDTH } from "@/lib/book/layout";
import { LIBRARY, bookList } from "./fixtures/library";
import { expect, test } from "./fixtures/test";

// The Bookstore as a guest (plans/bookstore.md D8, D14): its books are the example books until
// it has its own tables, and saving one copies it into the browser's library.

test.describe("Bookstore, as a guest", () => {
  test("browses, opens a book, saves it, and finds it in the Library with its origin", async ({ page }) => {
    await page.goto("/dashboard/bookstore");
    const cards = page.getByRole("list", { name: "Store books" });
    await expect(cards.getByRole("link")).not.toHaveCount(0);

    await page.getByRole("radio", { name: "Black" }).click();
    await expect(cards.getByRole("link", { name: /Queen's Gambit/ })).toHaveCount(0);
    await page.getByLabel("Search the Bookstore").fill("caro");
    await cards.getByRole("link", { name: /Caro-Kann Defense/ }).click();

    await expect(page).toHaveURL(/\/dashboard\/bookstore\/caro-kann-defense\?q=caro&side=black$/);
    await expect(page.getByRole("heading", { name: "Caro-Kann Defense", level: 1 })).toBeVisible();
    await expect(page.getByText("Verified").first()).toBeVisible();
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByText("In your library")).toBeVisible();

    await page.getByRole("link", { name: /Open in Library/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Caro-Kann Defense", level: 1 })).toBeVisible();
    await expect(page.getByText(/^Saved from the Bookstore, published by ByTheBook\./)).toBeVisible();

    await page.goto(LIBRARY);
    await expect(bookList(page).getByRole("link", { name: /Caro-Kann Defense/ })).toBeVisible();
  });

  test("a book's page says which book of the filtered shelf it is, and its ear goes back with the filters", async ({ page }) => {
    await page.goto("/dashboard/bookstore");
    const cards = page.getByRole("list", { name: "Store books" });
    await expect(cards.getByRole("link")).not.toHaveCount(0);
    await page.getByRole("radio", { name: "Black" }).click();
    await page.getByLabel("Search the Bookstore").fill("defense");
    await expect(page).toHaveURL(/\/dashboard\/bookstore\?q=defense&side=black$/);
    await cards.getByRole("link", { name: /French Defense/ }).click();
    await expect(page.getByRole("heading", { name: "French Defense", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/bookstore\/french-defense\?q=defense&side=black$/);
    // The shelf holds only the Black books with "defense" in their names.
    await expect(page.locator(".book-folio").first()).toContainText("Book 2 of 3");

    // The left page's ear, a link that says where it goes.
    const ear = page.getByRole("link", { name: "Back to the shelf" });
    await expect(ear).toContainText("Shelf");
    await ear.click();
    await expect(page.getByRole("heading", { name: "Bookstore", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Search the Bookstore")).toHaveValue("defense");
    await expect(page.getByRole("radio", { name: "Black" })).toHaveAttribute("aria-checked", "true");
    await expect(cards.getByRole("link")).toHaveCount(3);
  });

  test("the shelf never scrolls sideways", async ({ page }) => {
    await page.goto("/dashboard/bookstore");
    await expect(page.getByRole("list", { name: "Store books" }).getByRole("link")).not.toHaveCount(0);
    const sideways = await page.locator('[data-slot="page"]').evaluateAll((pages) =>
      pages.flatMap((pageEl) => [pageEl, ...pageEl.querySelectorAll("*")]).filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth).length,
    );
    expect(sideways).toBe(0);
  });

  test("a book's page fits its spread at every spread window size (D24)", async ({ page }) => {
    await page.goto("/dashboard/bookstore/queens-gambit");
    await expect(page.getByRole("heading", { name: "Queen's Gambit", level: 1 })).toBeVisible();
    for (const size of BOOK_WINDOW_SIZES.filter((size) => size.width >= SPREAD_MIN_WIDTH)) {
      await page.setViewportSize(size);
      await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "spread");
      for (const side of ["left", "right"]) {
        const body = page.locator(`[data-slot="page"][data-side="${side}"] .book-page-body`);
        const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(overflow, `${size.name}: the ${side} page`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("a book's page lists its chapters, and its reviews and leaderboard say how they fill, with no box to write a review (D22, D24)", async ({ page }) => {
    await page.goto("/dashboard/bookstore/italian-game");
    const chapters = page.getByRole("region", { name: "In this book" });
    await chapters.getByRole("button", { name: /Giuoco Piano/ }).click();
    await expect(page.getByText("Current position")).toBeVisible();
    // The Explorer opens the position alone, since the book isn't in the library.
    await expect(page.getByRole("link", { name: "Open in Explorer" })).toHaveAttribute("href", /^\/dashboard\/explorer\?line=[a-h1-8]{4}(%2C[a-h1-8]{4})*$/);

    const readers = page.getByRole("region", { name: "Reviews and leaderboard" });
    await expect(readers.getByText(/^No reviews yet\./)).toBeVisible();
    await expect(readers.getByText("Readers review it from their library")).toBeVisible();
    await expect(page.getByRole("button", { name: /review/i })).toHaveCount(0);
    await readers.getByRole("radio", { name: "Leaderboard" }).click();
    await expect(readers.getByText(/^No one is on the leaderboard yet\./)).toBeVisible();
  });

  test("an address that names no store book says so", async ({ page }) => {
    await page.goto("/dashboard/bookstore/not-a-book");
    await expect(page.getByText("The Bookstore has no such book.")).toBeVisible();
  });
});
