import { NAV_ITEMS, VISUALIZATIONS, requiresAccount } from "@/lib/auth/access";
import { expect, test } from "./fixtures/test";

// The proxy's guest rule (src/proxy.ts), checked through the running app.
const accountOnly = [...NAV_ITEMS, ...VISUALIZATIONS].filter((page) => page.access === "account");
const openToGuests = [...NAV_ITEMS, ...VISUALIZATIONS].filter((page) => page.access === "everyone");

test.describe("Access, as a guest", () => {
  for (const page of accountOnly) {
    test(`${page.label} sends a guest to sign in`, async ({ page: browser }) => {
      expect(requiresAccount(page.href)).toBe(true);
      await browser.goto(page.href);
      await browser.waitForURL(/\/auth\/login/);
      expect(new URL(browser.url()).searchParams.get("next")).toBe(page.href);
    });
  }

  for (const page of openToGuests) {
    test(`${page.label} opens for a guest`, async ({ page: browser }) => {
      const response = await browser.goto(page.href);
      expect(response?.ok()).toBe(true);
      expect(new URL(browser.url()).pathname).toBe(page.href);
    });
  }
});
