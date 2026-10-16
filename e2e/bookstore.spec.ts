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

  test("a book's page lists the shelf as the filters left it, and the way back keeps them", async ({ page }) => {
    await page.goto("/dashboard/bookstore");
    const cards = page.getByRole("list", { name: "Store books" });
    await expect(cards.getByRole("link")).not.toHaveCount(0);
    await page.getByRole("radio", { name: "Black" }).click();
    await page.getByLabel("Search the Bookstore").fill("defense");
    await expect(page).toHaveURL(/\/dashboard\/bookstore\?q=defense&side=black$/);
    await cards.getByRole("link", { name: /French Defense/ }).click();
    await expect(page.getByRole("heading", { name: "French Defense", level: 1 })).toBeVisible();

    // Beside it, only the Black books with "defense" in their names, this one picked.
    const shelf = page.getByRole("list", { name: "Books" });
    await expect(shelf.getByRole("link")).toHaveText([/Caro-Kann Defense/, /French Defense/, /Sicilian Defense/]);
    await expect(shelf.locator('[aria-current="true"]')).toContainText("French Defense");
    await shelf.getByRole("link", { name: /Sicilian Defense/ }).click();
    await expect(page.getByRole("heading", { name: "Sicilian Defense", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/bookstore\/sicilian-defense\?q=defense&side=black$/);

    await page.getByRole("link", { name: "Back to the shelf" }).click();
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

  test("a book's page fits its first screen at every spread window size, with what lies below in sight", async ({ page }) => {
    await page.goto("/dashboard/bookstore/queens-gambit");
    await expect(page.getByRole("heading", { name: "Queen's Gambit", level: 1 })).toBeVisible();
    const right = page.locator('[data-slot="page"][data-side="right"]');
    for (const size of BOOK_WINDOW_SIZES.filter((size) => size.width >= SPREAD_MIN_WIDTH)) {
      await page.setViewportSize(size);
      await expect(page.locator(".book-frame")).toHaveAttribute("data-form", "spread");
      for (const part of [".book-fold", ".book-page-body"]) {
        const overflow = await right.locator(part).evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(overflow, `${size.name}: ${part}`).toBeLessThanOrEqual(0);
      }
      const fold = await right.locator(".book-fold").evaluate((el) => el.getBoundingClientRect().bottom);
      const below = await page.getByRole("heading", { name: "About this book" }).evaluate((el) => el.getBoundingClientRect().top);
      expect(fold, size.name).toBeLessThan(size.height);
      expect(below, size.name).toBeLessThan(size.height);
    }
  });

  test("an address that names no store book says so", async ({ page }) => {
    await page.goto("/dashboard/bookstore/not-a-book");
    await expect(page.getByText("The Bookstore has no such book.")).toBeVisible();
  });
});
