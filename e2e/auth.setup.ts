import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { ACCOUNT_STATE, signIn, testAccount } from "./fixtures/account";

// Signs the test account in through the real login page once per run, and saves its
// session for the specs that use `ACCOUNT_STATE`.
setup("sign in the test account", async ({ page }) => {
  fs.mkdirSync(path.dirname(ACCOUNT_STATE), { recursive: true });

  const account = testAccount();
  if (!account) {
    // The specs that need an account skip; an empty state keeps the others working.
    fs.writeFileSync(ACCOUNT_STATE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  await signIn(page, account);
  await expect(page.getByText(/^Signed in as/)).toBeVisible();

  await page.context().storageState({ path: ACCOUNT_STATE });
});
