"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DARK_QUERY,
  DEFAULT_THEME_CHOICE,
  DEFAULT_VIBES,
  LEGACY_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  VIBES_STORAGE_KEY,
  parseThemeChoice,
  parseVibes,
  resolveTheme,
  type Theme,
  type ThemeChoice,
} from "@/lib/appearance";

type Appearance = {
  /** What the viewer picked. */
  themeChoice: ThemeChoice;
  /** The theme on screen: the choice, with "system" resolved. */
  theme: Theme;
  vibes: boolean;
};

type AppearanceContextValue = Appearance & {
  setThemeChoice: (choice: ThemeChoice) => void;
  setVibes: (on: boolean) => void;
};

const SERVER_SNAPSHOT: Appearance = {
  themeChoice: DEFAULT_THEME_CHOICE,
  theme: "light",
  vibes: DEFAULT_VIBES,
};

const AppearanceContext = createContext<AppearanceContextValue>({
  ...SERVER_SNAPSHOT,
  setThemeChoice: () => {},
  setVibes: () => {},
});

// The settings are an external store kept in localStorage. The head script
// (APPEARANCE_SCRIPT) has already written them to <html> before the first paint; the server
// render and hydration use the defaults, and the stored values follow straight after.
const listeners = new Set<() => void>();
/** The settings on this page. Null until read, or after another tab or the system changes them. */
let current: Appearance | null = null;

function notify() {
  current = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  if (listeners.size === 1) {
    window.addEventListener("storage", notify);
    media.addEventListener("change", notify);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", notify);
      media.removeEventListener("change", notify);
    }
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves a setting; when storage is blocked it lasts for this page only. */
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
  } catch {
    // Kept in `overrides` below.
  }
}

/** Settings made while storage is blocked. */
const overrides: { themeChoice?: ThemeChoice; vibes?: boolean } = {};

function snapshot(): Appearance {
  if (current === null) {
    const themeChoice =
      overrides.themeChoice ?? parseThemeChoice(read(THEME_STORAGE_KEY), read(LEGACY_MODE_STORAGE_KEY));
    current = {
      themeChoice,
      theme: resolveTheme(themeChoice, window.matchMedia(DARK_QUERY).matches),
      vibes: overrides.vibes ?? parseVibes(read(VIBES_STORAGE_KEY)),
    };
  }
  return current;
}

function setThemeChoice(choice: ThemeChoice) {
  overrides.themeChoice = choice;
  write(THEME_STORAGE_KEY, choice);
  notify();
}

function setVibes(on: boolean) {
  overrides.vibes = on;
  write(VIBES_STORAGE_KEY, on ? "on" : "off");
  notify();
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);

  // Writes the settings to <html> again on every change. It also restores them after React
  // resets the attributes, which happens in development when Strict Mode remounts. It reads
  // the store rather than `appearance`, which holds the defaults during hydration, so a dark
  // page never turns light for a frame.
  useLayoutEffect(() => {
    const { theme, vibes } = snapshot();
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-vibes", vibes ? "on" : "off");
  }, [appearance.theme, appearance.vibes]);

  return (
    <AppearanceContext.Provider value={{ ...appearance, setThemeChoice, setVibes }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
