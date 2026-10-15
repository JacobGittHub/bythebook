// The turn spike's pages (plans/book-ui.md Phase 2, first step). A scratch route: it goes once
// the user has watched the turns and the book shell is built.

export const SPIKE_PAGES = [
  { key: "overview", label: "Overview", fig: "I" },
  { key: "explorer", label: "Explorer", fig: "II" },
  { key: "library", label: "Library", fig: "III" },
  { key: "settings", label: "Settings", fig: "IV" },
] as const;

export type SpikePage = (typeof SPIKE_PAGES)[number]["key"];

export const SPIKE_BASE = "/spike/book-turn";

export function pageIndex(key: string): number {
  return SPIKE_PAGES.findIndex((p) => p.key === key);
}

/** The view transition type of a move from one page to another: book order says the way. */
export function turnType(from: string, to: string): "turn-forward" | "turn-back" {
  return pageIndex(to) > pageIndex(from) ? "turn-forward" : "turn-back";
}
