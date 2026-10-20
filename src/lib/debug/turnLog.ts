// What the bug report says about the book's last moves between pages (plans/book-ui.md Phase 4,
// the Safari check): whether the browser has view transitions, and for each move which way it
// went, which animations ran, whether the browser finished it or skipped it, and how smoothly
// its frames came. A phone has no console to read, so this is how its turns are seen.

import type { BugReportSection } from "./bugReport";

/** One move between pages, as `useTurnLog` (src/components/book/) watched it. */
export type TurnRecord = {
  from: string;
  to: string;
  /** `data-turn` and `data-zoom` on <html> as the move's pictures were ready. */
  way: string | null;
  zoom: string | null;
  /** The name of each animation that started on the move's pictures. */
  animations: string[];
  outcome: "running" | "finished" | "skipped";
  /** The name of the error the browser skipped it with. */
  error: string | null;
  /** From the pictures being ready to the move's end. */
  ms: number | null;
  frames: number;
  longestFrameMs: number;
};

/** How many moves the report keeps, the latest last. */
export const TURN_LOG_LENGTH = 6;

/** Each animation's name once, with how many ran, in the order they first ran. */
function countNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

function describe(record: TurnRecord): string {
  const move = `${record.from} → ${record.to || "?"}`;
  const way = [record.way ?? "no turn", ...(record.zoom ? [`zoom ${record.zoom}`] : [])].join(", ");
  const outcome = record.error ? `${record.outcome} (${record.error})` : record.outcome;
  const timing =
    record.ms === null
      ? `${record.frames} frames`
      : `${Math.round(record.ms)} ms, ${record.frames} frames, longest ${Math.round(record.longestFrameMs)} ms`;
  const animations = record.animations.length ? countNames(record.animations) : "no animations";
  return `${move}: ${way}; ${outcome}; ${timing}; ${animations}`;
}

/** The report's section on page turns. */
export function turnLogSection(records: readonly TurnRecord[], viewTransitions: boolean, motion: string): BugReportSection {
  return {
    title: "Page turns",
    lines: [
      ["View transitions", viewTransitions ? "yes" : "no"],
      ["Motion", motion],
      ...(records.length
        ? records.map((record, i): [string, string] => [`Move ${i + 1}`, describe(record)])
        : [["Moves", "none yet"] as [string, string]]),
    ],
  };
}
