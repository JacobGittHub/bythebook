import { ACCOUNT_STATE, NO_ACCOUNT_REASON, testAccount } from "./fixtures/account";
import { LABYRINTH, waitForSettledMap, zoomAt } from "./fixtures/labyrinth";
import { expect, test } from "./fixtures/test";

// Debug mode (plans/testing.md, D9) checks whichever way the server runs: with
// DEBUG_MODE=true under `next dev` every visitor gets the button, and otherwise no guest
// does. The test reads the same .env.local the server does.
const DEBUG_ON = process.env.DEBUG_MODE?.trim().toLowerCase() === "true" && !process.env.CI;

const copyButton = { name: "Copy bug report" } as const;

test.describe("Debug mode, as a guest", () => {
  test.skip(({ isMobile }) => isMobile, "The button is in the sidebar, a closed drawer on a phone.");

  test("shows the button only when debug mode is on", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", copyButton)).toHaveCount(DEBUG_ON ? 1 : 0);
  });

  test("copies a report of the page", async ({ page, browserName, context }) => {
    test.skip(!DEBUG_ON, "Debug mode is off.");
    test.skip(browserName !== "chromium", "Only Chromium lets a test read the clipboard.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/dashboard/explorer");
    await expect(page.getByRole("button", { name: /^e4 White/ })).toBeVisible();
    await page.getByRole("button", copyButton).click();
    await expect(page.getByRole("button", { name: "Bug report copied" })).toBeVisible();

    const report = await page.evaluate(() => navigator.clipboard.readText());
    expect(report).toContain("ByTheBook bug report");
    expect(report).toContain(`Page: ${page.url()}`);
    expect(report).toContain("Viewer: guest");
  });
});

test.describe("Debug mode, in the Labyrinth", () => {
  test.skip(!testAccount(), NO_ACCOUNT_REASON);
  test.skip(!DEBUG_ON, "Debug mode is off.");
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Clipboard tests run in desktop Chromium.");
  test.use({ storageState: ACCOUNT_STATE });

  test("a report's Reproduce address reopens the same view", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(LABYRINTH);
    await waitForSettledMap(page);
    await zoomAt(page, 25);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).not.toHaveText("Starting position", { timeout: 30_000 });
    await waitForSettledMap(page);
    const title = await heading.textContent();

    await page.getByRole("button", copyButton).click();
    const report = await page.evaluate(() => navigator.clipboard.readText());
    const reproduce = report.match(/^Reproduce: (.+)$/m)?.[1];
    expect(reproduce).toContain("?camera=");

    await page.goto(reproduce!);
    await waitForSettledMap(page);
    await expect(heading).toHaveText(title!, { timeout: 30_000 });
  });
});
