import { describe, expect, it } from "vitest";
import { formatBugReport, type BugReportInput } from "./bugReport";

const base: BugReportInput = {
  url: "http://localhost:3000/dashboard/explorer",
  time: new Date("2026-10-05T12:00:00Z"),
  window: { width: 1440, height: 900, pixelRatio: 2 },
  background: "cream",
  signedIn: false,
  browser: "TestBrowser/1.0",
  sections: [],
};

describe("formatBugReport", () => {
  it("lists the page, the window and the viewer", () => {
    expect(formatBugReport(base)).toBe(
      [
        "ByTheBook bug report",
        "Page: http://localhost:3000/dashboard/explorer",
        "Time: 2026-10-05T12:00:00.000Z",
        "Window: 1440×900, pixel ratio 2",
        "Background: cream",
        "Viewer: guest",
        "Browser: TestBrowser/1.0",
      ].join("\n"),
    );
  });

  it("adds each page section, and an absolute address that reproduces the state", () => {
    const report = formatBugReport({
      ...base,
      url: "https://bythebook.example/dashboard/visualizations/labyrinth",
      signedIn: true,
      sections: [
        {
          title: "Labyrinth",
          lines: [
            ["Line", "1. e4 c5"],
            ["Panel", "open"],
          ],
          reproduce: "/dashboard/visualizations/labyrinth?camera=1,2,3",
        },
      ],
    });
    const lines = report.split("\n");
    expect(lines[2]).toBe(
      "Reproduce: https://bythebook.example/dashboard/visualizations/labyrinth?camera=1,2,3",
    );
    expect(lines).toContain("Viewer: signed in");
    expect(lines.slice(-4)).toEqual(["", "Labyrinth", "- Line: 1. e4 c5", "- Panel: open"]);
  });
});
