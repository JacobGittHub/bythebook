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

    await expect(page).toHaveURL(/\/dashboard\/bookstore\/caro-kann-defense$/);
    await expect(page.getByRole("heading", { name: "Caro-Kann Defense", level: 1 })).toBeVisible();
    await expect(page.getByText("Verified").first()).toBeVisible();
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByText("In your library")).toBeVisible();

    await page.getByRole("link", { name: /Open in Library/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/library\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Caro-Kann Defense", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Where this book came from" })).toContainText("From the Bookstore");

    await page.goto(LIBRARY);
    await expect(bookList(page).getByRole("button", { name: /Caro-Kann Defense/ })).toBeVisible();
  });

  test("an address that names no store book says so", async ({ page }) => {
    await page.goto("/dashboard/bookstore/not-a-book");
    await expect(page.getByText("The Bookstore has no such book.")).toBeVisible();
  });
});
