"use client";

import { createContext, useContext, type ReactNode } from "react";

type ViewerContextValue = {
  /** False for a guest. Guests can't save, so components hide what would need an account. */
  signedIn: boolean;
};

const ViewerContext = createContext<ViewerContextValue>({ signedIn: false });

export function ViewerProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={{ signedIn }}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
