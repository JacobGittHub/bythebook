// WCAG 2 contrast for the theme tokens in src/app/globals.css: reading the tokens a theme
// sets, resolving `var()`, and the contrast ratio of two colors. Pure, so it runs in Node.

export type Rgba = { r: number; g: number; b: number; a: number };

/** A theme's custom properties, by name without the leading `--`. */
export type Tokens = Map<string, string>;

/** Parses `#rgb`, `#rrggbb`, `rgb(r g b / a)` and `rgb(r, g, b)`, or returns null. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(v);
  if (!fn) return null;
  const [rgb, alpha] = fn[1].split("/");
  const parts = rgb.split(/[\s,]+/).filter(Boolean).map(Number);
  const commaAlpha = parts.length === 4 ? parts.pop() : undefined;
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const a = alpha !== undefined ? Number(alpha.trim()) : (commaAlpha ?? 1);
  return { r: parts[0], g: parts[1], b: parts[2], a };
}

/** `top` painted over an opaque `bottom`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The WCAG 2 contrast ratio of two opaque colors, from 1 to 21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The tokens one theme sets: every rule whose selector list holds one of `selectors`, in the
 * order the stylesheet gives them, so a later rule overrides an earlier one as in the browser.
 */
export function readTokens(css: string, selectors: string[]): Tokens {
  const tokens: Tokens = new Map();
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = rule[1].split(",").map((s) => s.trim());
    if (!list.some((s) => selectors.includes(s))) continue;
    for (const decl of rule[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      tokens.set(decl[1], decl[2].trim());
    }
  }
  return tokens;
}

/** A token's color with every `var()` followed, or null if it isn't a plain color. */
export function resolveColor(tokens: Tokens, name: string, seen: string[] = []): Rgba | null {
  const value = tokens.get(name);
  if (value === undefined || seen.includes(name)) return null;
  const ref = /^var\(--([\w-]+)\)$/.exec(value.trim());
  if (ref) return resolveColor(tokens, ref[1], [...seen, name]);
  return parseColor(value);
}
