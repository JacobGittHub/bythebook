"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
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

export function BackgroundModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BackgroundMode>(DEFAULT_MODE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as BackgroundMode | null;
    const initial =
      stored && VALID_MODES.includes(stored) ? stored : DEFAULT_MODE;
    applyMode(initial);
    setModeState(initial);
  }, []);

  function setMode(m: BackgroundMode) {
    applyMode(m);
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  }

  return (
    <BackgroundModeContext.Provider value={{ mode, setMode }}>
      {children}
    </BackgroundModeContext.Provider>
  );
}

export function useBackgroundMode() {
  return useContext(BackgroundModeContext);
}
