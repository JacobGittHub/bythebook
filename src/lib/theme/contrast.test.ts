import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoViolations } from "@/lib/regions/testShapes";
import { composite, contrastRatio, parseColor, readTokens, resolveColor, type Tokens } from "./contrast";

const CSS = readFileSync(
  path.resolve(import.meta.dirname, "../../app/globals.css"),
  "utf8",
).replace(/\r\n/g, "\n");

const LIGHT = readTokens(CSS, [":root", '[data-theme="light"]']);
const DARK = readTokens(CSS, [":root", '[data-theme="light"]', '[data-theme="dark"]']);

// WCAG 2 AA: 4.5 for text (1.4.3), 3 for the parts of a control or mark that must be seen (1.4.11).
const TEXT = 4.5;
const MARK = 3;

/** [color, ground, minimum]: text or a mark in `color` on `ground`, which lies on the page. */
const PAIRS: [string, string, number][] = [
  ["foreground", "page", TEXT],
  ["foreground", "page-alt", TEXT],
  ["foreground", "muted", TEXT],
  ["foreground", "accent", TEXT],
  ["muted-foreground", "page", TEXT],
  ["muted-foreground", "page-alt", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["muted-foreground", "accent", TEXT],
  ["primary", "page", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["destructive", "page", TEXT],
  ["destructive-foreground", "destructive", TEXT],
  ["warning", "page", TEXT],
  ["success", "page", TEXT],
  ["bookmark", "page", MARK],
  ["ring", "page", MARK],
  // What lies on the walnut desk (D20): the strip's and the chapter column's text, and the
  // current tab's underline in the strip.
  ["desk-foreground", "desk", TEXT],
  ["desk-muted", "desk", TEXT],
  ["desk-mark", "desk", MARK],
];

function violations(theme: string, tokens: Tokens): string[] {
  const page = resolveColor(tokens, "page");
  if (!page || page.a !== 1) return [`${theme}: --page is not an opaque color`];
  const out: string[] = [];
  for (const [fg, bg, min] of PAIRS) {
    const f = resolveColor(tokens, fg);
    const b = resolveColor(tokens, bg);
    if (!f || !b) {
      out.push(`${theme}: --${!f ? fg : bg} is not a color`);
      continue;
    }
    const ground = composite(b, page);
    const ratio = contrastRatio(composite(f, ground), ground);
    if (ratio < min) out.push(`${theme}: --${fg} on --${bg} is ${ratio.toFixed(2)}, under ${min}`);
  }
  return out;
}

describe("theme contrast", () => {
  it("passes WCAG AA for every listed pair in light and dark", () => {
    expectNoViolations([...violations("light", LIGHT), ...violations("dark", DARK)]);
  });

  it("reads the tokens each theme sets, and dark overrides light", () => {
    expect(LIGHT.get("page")).not.toBe(DARK.get("page"));
    expect(LIGHT.get("card")).toBe("var(--page)");
    expect(DARK.get("card")).toBe("var(--page)");
  });
});

describe("contrast math", () => {
  it("gives the known ratios", () => {
    const black = parseColor("#000")!;
    const white = parseColor("#ffffff")!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(parseColor("#767676")!, white)).toBeCloseTo(4.54, 2);
  });

  it("parses alpha and composites it over the ground", () => {
    const half = parseColor("rgb(0 0 0 / 0.5)")!;
    expect(half.a).toBe(0.5);
    expect(composite(half, parseColor("#ffffff")!).r).toBeCloseTo(127.5, 5);
    expect(parseColor("rgba(10, 20, 30, 0.25)")).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
    expect(parseColor("var(--x)")).toBeNull();
  });
});
