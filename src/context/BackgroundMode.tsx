"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type BackgroundMode = "cream" | "dark" | "blue" | "green" | "red";

const VALID_MODES: BackgroundMode[] = ["cream", "dark", "blue", "green", "red"];
const STORAGE_KEY = "bg-mode";
const DEFAULT_MODE: BackgroundMode = "cream";

type BackgroundModeContextValue = {
  mode: BackgroundMode;
  setMode: (mode: BackgroundMode) => void;
};

const BackgroundModeContext = createContext<BackgroundModeContextValue>({
  mode: DEFAULT_MODE,
  setMode: () => {},
});

function applyMode(mode: BackgroundMode) {
  const html = document.documentElement;
  html.setAttribute("data-bg", mode);
  if (mode === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

// The mode is an external store kept in localStorage. The server and the first client
// render use the default, and the stored mode follows straight after hydration.
const listeners = new Set<() => void>();
/** The mode on this page. Null until read from storage, or after another tab changes it. */
let current: BackgroundMode | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage() {
  current = null;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function readMode(): BackgroundMode {
  if (current === null) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as BackgroundMode | null;
      current = stored && VALID_MODES.includes(stored) ? stored : DEFAULT_MODE;
    } catch {
      current = DEFAULT_MODE;
    }
  }
  return current;
}

function setMode(mode: BackgroundMode) {
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage is blocked, so the mode lasts for this page only.
  }
  notify();
}

export function BackgroundModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  return (
    <BackgroundModeContext.Provider value={{ mode, setMode }}>
      {children}
    </BackgroundModeContext.Provider>
  );
}

export function useBackgroundMode() {
  return useContext(BackgroundModeContext);
}
