"use client";

import { useState } from "react";
import { useBackgroundMode } from "@/context/BackgroundMode";
import { useBugReportSections } from "@/context/BugReport";
import { formatBugReport } from "@/lib/debug/bugReport";

/**
 * Copies one block of text describing what is on screen, for a bug report. Shown only in
 * debug mode (`canDebug`, plans/testing.md D9).
 */
export function BugReportButton({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const { mode } = useBackgroundMode();
  const readSections = useBugReportSections();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    const report = formatBugReport({
      url: window.location.href,
      time: new Date(),
      window: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      background: mode,
      signedIn,
      browser: navigator.userAgent,
      sections: readSections(),
    });
    try {
      await navigator.clipboard.writeText(report);
      setStatus("copied");
    } catch {
      // The clipboard can be blocked; the console still has the text to copy by hand.
      console.info(report);
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button type="button" onClick={copy} className={className}>
      {status === "copied"
        ? "Bug report copied"
        : status === "failed"
          ? "Copy blocked: see console"
          : "Copy bug report"}
    </button>
  );
}
