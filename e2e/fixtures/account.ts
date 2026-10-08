import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * The browser storage of the signed-in test account, written by `e2e/auth.setup.ts`. It
 * holds a live session, so its folder is gitignored.
 */
export const ACCOUNT_STATE = path.join(__dirname, "..", ".auth", "account.json");

/**
 * The test account, from `E2E_EMAIL` and `E2E_PASSWORD`. It is a normal beta account made
 * with an invite code, kept for tests. Without it, the specs that need an account skip.
 */
export function testAccount(): { email: string; password: string } | null {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return email && password ? { email, password } : null;
}

export const NO_ACCOUNT_REASON =
  "Set E2E_EMAIL and E2E_PASSWORD (a test account) to run the specs that need an account.";

/** Signs `account` in through the real login page, which lands on the Overview. */
export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/auth/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
}
