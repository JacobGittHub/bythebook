"use client";

import { Bug } from "lucide-react";
import { useState } from "react";
import { useAppearance } from "@/context/Appearance";
import { useBugReportSections } from "@/context/BugReport";
import { formatBugReport } from "@/lib/debug/bugReport";

/**
 * Copies text to the clipboard. A page served over plain http, such as a build opened from a
 * phone on the local network, has no clipboard API, so there it selects the text in a hidden
 * box and copies it with the older copy command, which Safari still allows from a press.
 */
async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text);
  const box = document.createElement("textarea");
  box.value = text;
  box.readOnly = true;
  // 16px keeps Safari from zooming in on the box.
  box.style.cssText = "position: fixed; top: 0; left: 0; opacity: 0; font-size: 16px;";
  document.body.append(box);
  box.select();
  box.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  box.remove();
  if (!copied) throw new Error("The browser refused to copy.");
}

/**
 * Copies one block of text describing what is on screen, for a bug report. Shown only in
 * debug mode (`canDebug`, plans/testing.md D9).
 */
export function BugReportButton({
  signedIn,
  icon = false,
  className,
  textClassName,
}: {
  signedIn: boolean;
  /** Shows a bug icon before the text, for the chapter column, whose narrow form hides the text. */
  icon?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const { theme, themeChoice, vibes } = useAppearance();
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
      appearance: { theme, themeChoice, vibes },
      signedIn,
      browser: navigator.userAgent,
      sections: readSections(),
    });
    try {
      await copyText(report);
      setStatus("copied");
    } catch {
      // The clipboard can be blocked; the console still has the text to copy by hand.
      console.info(report);
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  const label =
    status === "copied" ? "Bug report copied" : status === "failed" ? "Copy blocked: see console" : "Copy bug report";

  return (
    <button type="button" onClick={copy} className={className} aria-label={label} title={icon ? label : undefined}>
      {icon && <Bug aria-hidden className="size-4 flex-none" />}
      <span className={textClassName}>{label}</span>
    </button>
  );
}
