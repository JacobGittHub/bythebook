"use client";

import { useCallback, useSyncExternalStore } from "react";

// A string kept in localStorage, for per-viewer conveniences such as a chosen view or panel
// sizes. The server and the first client render see null, and the stored value follows
// straight after hydration. Storage can be blocked, so a value then lasts for the page only.

const listeners = new Map<string, Set<() => void>>();
const values = new Map<string, string | null>();

function read(key: string): string | null {
  if (!values.has(key)) {
    try {
      values.set(key, localStorage.getItem(key));
    } catch {
      values.set(key, null);
    }
  }
  return values.get(key) ?? null;
}

function write(key: string, value: string | null) {
  values.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked: the value lasts for this page.
  }
  listeners.get(key)?.forEach((listener) => listener());
}

export function useStoredString(key: string): [string | null, (value: string | null) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const set = listeners.get(key) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback((next: string | null) => write(key, next), [key]);
  return [value, set];
}
