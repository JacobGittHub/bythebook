// The viewer's appearance settings (plans/vibes.md D2, plans/book-ui.md D13): a theme of light,
// dark or the system's, whether vibes are on, and how the book's pages move. All are kept in
// the browser, for guests and accounts alike, and written to <html> as `data-theme`,
// `data-vibes` and `data-motion`, which the CSS reads.

export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];
export const DEFAULT_THEME_CHOICE: ThemeChoice = "system";
export const DEFAULT_VIBES = true;

export const THEME_STORAGE_KEY = "theme";
export const VIBES_STORAGE_KEY = "vibes";
export const MOTION_STORAGE_KEY = "motion";
/** Where the five background modes were kept until 2026-10-12. Read once, then removed. */
export const LEGACY_MODE_STORAGE_KEY = "bg-mode";

export const DARK_QUERY = "(prefers-color-scheme: dark)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * How the book moves between chapters (D13): a page turn, or no motion at all. A browser that
 * kept Slide, removed on 2026-10-15, turns pages again.
 */
export type Motion = "turn" | "none";
export const MOTIONS: readonly Motion[] = ["turn", "none"];
export const DEFAULT_MOTION: Motion = "turn";

/**
 * The stored theme choice. A browser that still holds an old background mode keeps dark if
 * it chose dark, and light for any of the four light colors.
 */
export function parseThemeChoice(stored: string | null, legacyMode: string | null): ThemeChoice {
  if (stored !== null && (THEME_CHOICES as readonly string[]).includes(stored)) {
    return stored as ThemeChoice;
  }
  if (legacyMode !== null) return legacyMode === "dark" ? "dark" : "light";
  return DEFAULT_THEME_CHOICE;
}

export function parseVibes(stored: string | null): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  return DEFAULT_VIBES;
}

export function parseMotion(stored: string | null): Motion {
  return stored !== null && (MOTIONS as readonly string[]).includes(stored) ? (stored as Motion) : DEFAULT_MOTION;
}

/** The motion on screen: none when the system asks for reduced motion, whatever was picked. */
export function resolveMotion(choice: Motion, systemReducesMotion: boolean): Motion {
  return systemReducesMotion ? "none" : choice;
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/**
 * The script the root layout runs in <head>, before the first paint, so a dark page never
 * flashes light (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
 * It repeats parseThemeChoice, parseVibes and resolveTheme in plain JavaScript;
 * appearance.test.ts runs it against them.
 */
export const APPEARANCE_SCRIPT = `(function(){try{var s=localStorage,d=document.documentElement,t=s.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)}),l=s.getItem(${JSON.stringify(LEGACY_MODE_STORAGE_KEY)}),v=s.getItem(${JSON.stringify(
  VIBES_STORAGE_KEY,
)});if(${JSON.stringify(THEME_CHOICES)}.indexOf(t)<0)t=l===null?${JSON.stringify(
  DEFAULT_THEME_CHOICE,
)}:l==="dark"?"dark":"light";if(t==="system")t=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light";d.setAttribute("data-theme",t);d.setAttribute("data-vibes",v==="on"||v==="off"?v:${JSON.stringify(
  DEFAULT_VIBES ? "on" : "off",
)})}catch(e){}})()`;
