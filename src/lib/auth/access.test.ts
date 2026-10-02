import { describe, expect, it } from "vitest";
import { NAV_ITEMS, requiresAccount, visibleNavItems } from "./access";

describe("visibleNavItems", () => {
  it("never shows a guest an account-only page", () => {
    expect(visibleNavItems(false).every((item) => item.access === "everyone")).toBe(true);
  });

  it("shows a signed-in user every page, in the listed order", () => {
    expect(visibleNavItems(true)).toEqual(NAV_ITEMS);
  });

  it("has no two links to the same page", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("requiresAccount", () => {
  it("agrees with the sidebar: a page needs an account exactly when its link is hidden from guests", () => {
    for (const item of NAV_ITEMS) {
      expect(requiresAccount(item.href)).toBe(item.access === "account");
    }
  });

  it("covers pages below an account-only page", () => {
    expect(requiresAccount("/dashboard/lab")).toBe(true);
    expect(requiresAccount("/dashboard/lab/regions")).toBe(true);
  });

  it("does not match a different page that starts with the same letters", () => {
    expect(requiresAccount("/dashboard/labs")).toBe(false);
  });

  it("lets guests into the dashboard and the pages below it", () => {
    expect(requiresAccount("/dashboard")).toBe(false);
    expect(requiresAccount("/dashboard/explorer")).toBe(false);
    expect(requiresAccount("/dashboard/train/some-book-id")).toBe(false);
  });
});
