import { describe, expect, it } from "vitest";
import { NAV_ITEMS, VISUALIZATIONS, requiresAccount, visibleNavItems } from "./access";

const ALL_PAGES = [...NAV_ITEMS, ...VISUALIZATIONS];

describe("visibleNavItems", () => {
  it("never shows a guest an account-only page", () => {
    expect(visibleNavItems(false).every((item) => item.access === "everyone")).toBe(true);
  });

  it("shows a signed-in user every page, in the listed order", () => {
    expect(visibleNavItems(true)).toEqual(NAV_ITEMS);
  });
});

describe("the page lists", () => {
  it("have no two buttons to the same page", () => {
    const hrefs = ALL_PAGES.map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("give every sidebar page but the Overview a longer description for its demo", () => {
    for (const item of NAV_ITEMS) {
      expect(Boolean(item.details)).toBe(item.href !== "/dashboard");
    }
  });

  it("keep every visualization under the Visualizations page", () => {
    for (const page of VISUALIZATIONS) {
      expect(page.href.startsWith("/dashboard/visualizations/")).toBe(true);
    }
  });
});

describe("requiresAccount", () => {
  it("agrees with the lists: a page needs an account exactly when it is marked so", () => {
    for (const page of ALL_PAGES) {
      expect(requiresAccount(page.href)).toBe(page.access === "account");
    }
  });

  it("covers pages below an account-only page", () => {
    expect(requiresAccount("/dashboard/visualizations/globe")).toBe(true);
    expect(requiresAccount("/dashboard/visualizations/globe/settings")).toBe(true);
  });

  it("does not match a different page that starts with the same letters", () => {
    expect(requiresAccount("/dashboard/visualizations/globes")).toBe(false);
  });

  it("lets guests into the dashboard and the pages below it", () => {
    expect(requiresAccount("/dashboard")).toBe(false);
    expect(requiresAccount("/dashboard/explorer")).toBe(false);
    expect(requiresAccount("/dashboard/visualizations")).toBe(false);
    expect(requiresAccount("/dashboard/visualizations/atlas")).toBe(false);
    expect(requiresAccount("/dashboard/train/some-book-id")).toBe(false);
  });
});
