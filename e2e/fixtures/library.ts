import { expect, type Page } from "@playwright/test";

// Steps the Library's specs share.

export const LIBRARY = "/dashboard/library";

/** The Library's book list, whose rows are links named by their book and its positions. */
export const bookList = (page: Page) => page.getByRole("list", { name: "Books" });

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Makes a book from pasted moves, which keeps the page on the Library (the Explorer start
 * leaves it), and waits for it to be picked.
 */
export async function createPastedBook(page: Page, name: string, moves = "1. d4 d5 2. c4") {
  await page.getByRole("button", { name: "New book" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New book" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByText("Paste moves or PGN").click();
  await dialog.getByRole("textbox", { name: "Moves or PGN" }).fill(moves);
  await dialog.getByRole("button", { name: "Create book" }).click();
  await expect(dialog).toBeHidden();
  // Its row is current; on a phone, where the halves stack, the picked book doesn't show beside it.
  await expect(bookList(page).getByRole("link", { name: new RegExp(`^${escapeRegExp(name)} \\d`) })).toHaveAttribute("aria-current", "true");
}
