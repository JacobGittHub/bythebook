"use client";

import { useSyncExternalStore } from "react";

// A theme token's value, for code that needs a color string rather than CSS, such as
// react-chessboard's arrows, which it draws as SVG attributes that can't read `var()`.
// The value is read again whenever an attribute on <html> changes, which is how the theme,
// and later a vibe, switches (globals.css).

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

export function useThemeColor(token: `--${string}`, fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback,
    () => fallback,
  );
}
