import { ACCOUNT_STATE, NO_ACCOUNT_REASON, signIn, testAccount } from "./fixtures/account";
import { expect, test } from "./fixtures/test";

// The book routes against the live database, as the test account (plans/deployment.md
// Phase 5). Each run makes its own "e2e-" book and deletes it, even when a step fails.

const BOOKS = "/api/openings/books";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test.describe("Book routes, signed in", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.use({ storageState: ACCOUNT_STATE });

  let bookId: string | null = null;

  test.afterEach(async ({ page }) => {
    if (bookId) await page.request.delete(`${BOOKS}/${bookId}`);
    bookId = null;
  });

  test("create, change, refuse a stale or illegal change, and delete a book", async ({ page }) => {
    const name = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await page.request.post(BOOKS, { data: { name, color: "white", trees: [] } });
    expect(created.status()).toBe(201);
    const entry = await created.json();
    bookId = entry.id;
    expect(entry).toMatchObject({ name, color: "white", origin: { kind: "own" }, summary: { positions: 0 } });
    expect(entry).not.toHaveProperty("trees");

    const trees = [{ fen: START_FEN, children: [{ uci: "e2e4", children: [{ uci: "e7e5" }] }] }];
    const changed = await page.request.patch(`${BOOKS}/${bookId}`, {
      data: { name: `${name}-2`, trees, expectedUpdatedAt: entry.updatedAt },
    });
    expect(changed.status()).toBe(200);
    const updated = await changed.json();
    expect(updated.summary).toMatchObject({ positions: 2, lines: 1 });

    // A tab that still holds the first version is refused.
    const stale = await page.request.patch(`${BOOKS}/${bookId}`, {
      data: { color: "black", expectedUpdatedAt: entry.updatedAt },
    });
    expect(stale.status()).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "stale" });

    const illegal = await page.request.patch(`${BOOKS}/${bookId}`, {
      data: { trees: [{ fen: START_FEN, children: [{ uci: "e2e5" }] }], expectedUpdatedAt: updated.updatedAt },
    });
    expect(illegal.status()).toBe(400);
    expect(await illegal.json()).toMatchObject({ code: "invalid" });

    const book = await (await page.request.get(`${BOOKS}/${bookId}`)).json();
    expect(book.name).toBe(`${name}-2`);
    expect(book.trees[0].children[0]).toMatchObject({ san: "e4", uci: "e2e4" });

    const list = await (await page.request.get(BOOKS)).json();
    const listed = list.books.find((b: { id: string }) => b.id === bookId);
    expect(listed).toMatchObject({ name: `${name}-2`, summary: { positions: 2 } });
    expect(listed).not.toHaveProperty("trees");

    expect((await page.request.delete(`${BOOKS}/${bookId}`)).status()).toBe(204);
    expect((await page.request.get(`${BOOKS}/${bookId}`)).status()).toBe(404);
    bookId = null;
  });

  test("a book id that isn't one is not found, not an error", async ({ page }) => {
    expect((await page.request.get(`${BOOKS}/not-a-book`)).status()).toBe(404);
  });

  test("the Library names the account as the store it shows", async ({ page }) => {
    await page.goto("/dashboard/library");
    await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
    await expect(page.getByText("Kept in this browser", { exact: true })).toHaveCount(0);
  });
});

test.describe("Books in the browser at sign-in", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "It writes to the live database; one browser is enough.");

  const name = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  test.afterEach(async ({ page }) => {
    const list = await (await page.request.get(BOOKS)).json();
    for (const book of list.books ?? []) {
      if (book.name === name) await page.request.delete(`${BOOKS}/${book.id}`);
    }
  });

  test("a guest's book is offered at sign-in, and copied into the account leaves the browser", async ({ page }) => {
    await page.goto("/dashboard/library");
    await page.getByRole("button", { name: "+ New book" }).click();
    await page.getByPlaceholder(/Ruy Lopez/).fill(name);
    await page.getByRole("button", { name: "Create book" }).click();
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();

    await signIn(page, testAccount()!);
    const notice = page.getByRole("complementary", { name: "Books in this browser" });
    await expect(notice).toContainText("This browser holds 1 book from browsing as a guest.");
    await notice.getByRole("link", { name: "Open the Library to copy" }).click();

    const checklist = page.getByRole("region", { name: "Copy this browser's book into your account" });
    await expect(checklist).toContainText(name);
    await checklist.getByRole("button", { name: "Copy 1 book" }).click();
    await checklist.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
    await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();

    // The book left the browser, so nothing is offered any more.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
});
