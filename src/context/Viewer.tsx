"use client";

import { createContext, useContext, type ReactNode } from "react";

type ViewerContextValue = {
  /** False for a guest. Guests can't save, so components hide what would need an account. */
  signedIn: boolean;
  /** Whether this viewer gets debug mode (`canDebug`, `src/lib/auth/debug.ts`). */
  debug: boolean;
};

const ViewerContext = createContext<ViewerContextValue>({ signedIn: false, debug: false });

export function ViewerProvider({
  signedIn,
  debug = false,
  children,
}: {
  signedIn: boolean;
  debug?: boolean;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={{ signedIn, debug }}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
