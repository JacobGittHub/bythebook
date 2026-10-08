import { expect, type Page } from "@playwright/test";

// Steps the Library's specs share.

export const LIBRARY = "/dashboard/library";

/** The Library's book list, whose rows are buttons named by their book. */
export const bookList = (page: Page) => page.getByRole("list", { name: "Books" });

/**
 * Makes a book from pasted moves, which keeps the page on the Library (the Explorer start
 * leaves it), and waits for it to be selected.
 */
export async function createPastedBook(page: Page, name: string, moves = "1. d4 d5 2. c4") {
  await page.getByRole("button", { name: "New book" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New book" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByText("Paste moves or PGN").click();
  await dialog.getByRole("textbox", { name: "Moves or PGN" }).fill(moves);
  await dialog.getByRole("button", { name: "Create book" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
}
