import { visibleNavItems } from "@/lib/auth/access";
import { expect, test } from "../fixtures/test";

// The book's baselines (plans/book-ui.md Phase 4): every chapter, as a guest, at a laptop's
// window (the spread) and a phone's (the one-page form), in light only; dark is the contrast
// test's (src/lib/theme/contrast.test.ts) and the user's check.

const SIZES = [
  { name: "laptop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
];

/** What shows once a chapter has settled, where its first render isn't all of it. */
const SETTLED: Record<string, string> = {
  "/dashboard/explorer": "e4 White",
};

test.use({ colorScheme: "light" });

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport });

    for (const chapter of visibleNavItems(false)) {
      test(chapter.label, async ({ page }) => {
        await page.goto(chapter.href);
        await expect(page.locator(".book-frame")).toHaveAttribute("data-form", size.name === "phone" ? "single" : "spread");
        const settled = SETTLED[chapter.href];
        if (settled) await expect(page.getByRole("button", { name: new RegExp(`^${settled}`) })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        // Next's dev badge isn't part of the page.
        await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
        const name = chapter.label.toLowerCase().replace(/\s+/g, "-");
        // The Overview's demos are looping GIFs, which never hold still.
        await expect(page).toHaveScreenshot(`${name}-${size.name}.png`, { mask: [page.locator('img[src$=".gif"]')] });
      });
    }
  });
}
