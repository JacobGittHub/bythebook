"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BugReportSection } from "@/lib/debug/bugReport";

type Reader = () => BugReportSection;

type BugReportContextValue = {
  /** Adds a page's section to the report. Returns the function that takes it out. */
  register: (read: () => BugReportSection) => () => void;
  /** Every registered page's section, read now. */
  readSections: () => BugReportSection[];
};

const BugReportContext = createContext<BugReportContextValue>({
  register: () => () => {},
  readSections: () => [],
});

/**
 * Collects what pages add to a bug report (plans/testing.md, D9). It wraps the whole
 * dashboard, so the button in the sidebar can read the page beside it.
 */
export function BugReportProvider({ children }: { children: ReactNode }) {
  const [value] = useState<BugReportContextValue>(() => {
    const readers = new Set<{ read: Reader }>();
    return {
      register: (read) => {
        const entry = { read };
        readers.add(entry);
        return () => {
          readers.delete(entry);
        };
      },
      readSections: () => [...readers].map((entry) => entry.read()),
    };
  });
  return <BugReportContext.Provider value={value}>{children}</BugReportContext.Provider>;
}

/**
 * Adds this page's state to the bug report while the page is mounted. `read` is called only
 * when a report is copied, so it can read refs and other state outside React.
 */
export function useBugReportSection(read: Reader) {
  const { register } = useContext(BugReportContext);
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });
  useEffect(() => register(() => readRef.current()), [register]);
}

export function useBugReportSections() {
  return useContext(BugReportContext).readSections;
}
