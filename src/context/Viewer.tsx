"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type ViewerContextValue = {
  /** False for a guest. Guests can't save, so components hide what would need an account. */
  signedIn: boolean;
  /** The account's id, which keys what the browser keeps for it; null for a guest. */
  userId: string | null;
  /** Whether this viewer gets debug mode (`canDebug`, `src/lib/auth/debug.ts`). */
  debug: boolean;
};

const ViewerContext = createContext<ViewerContextValue>({ signedIn: false, userId: null, debug: false });

export function ViewerProvider({
  signedIn,
  userId = null,
  debug = false,
  children,
}: {
  signedIn: boolean;
  userId?: string | null;
  debug?: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ signedIn, userId, debug }), [signedIn, userId, debug]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
