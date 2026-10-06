// The text the "Copy bug report" button copies (plans/testing.md, D9). The user pastes it
// with a sentence about what's wrong, and an agent opens the same state in Playwright.

/** What a page adds about its own state. */
export type BugReportSection = {
  title: string;
  /** One line each, in order. */
  lines: [label: string, value: string][];
  /** An address that opens the page in this state, when the page can restore it. */
  reproduce?: string;
};

export type BugReportInput = {
  /** The page's full address. */
  url: string;
  time: Date;
  window: { width: number; height: number; pixelRatio: number };
  background: string;
  signedIn: boolean;
  browser: string;
  sections: BugReportSection[];
};

/** One block of plain text, the same for the same input. */
export function formatBugReport(input: BugReportInput): string {
  const reproduce = input.sections.find((section) => section.reproduce)?.reproduce;
  const lines = [
    "ByTheBook bug report",
    `Page: ${input.url}`,
    ...(reproduce ? [`Reproduce: ${new URL(reproduce, input.url).href}`] : []),
    `Time: ${input.time.toISOString()}`,
    `Window: ${input.window.width}×${input.window.height}, pixel ratio ${input.window.pixelRatio}`,
    `Background: ${input.background}`,
    `Viewer: ${input.signedIn ? "signed in" : "guest"}`,
    `Browser: ${input.browser}`,
  ];
  for (const section of input.sections) {
    lines.push("", section.title, ...section.lines.map(([label, value]) => `- ${label}: ${value}`));
  }
  return lines.join("\n");
}
