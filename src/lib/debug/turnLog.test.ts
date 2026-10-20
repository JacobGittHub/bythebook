import { describe, expect, it } from "vitest";
import { turnLogSection, type TurnRecord } from "./turnLog";

const turn: TurnRecord = {
  from: "/dashboard/library",
  to: "/dashboard/bookstore",
  way: "forward",
  zoom: null,
  animations: ["turn-fold-right", "turn-open-right", "camera", "camera"],
  outcome: "finished",
  error: null,
  ms: 452.4,
  frames: 27,
  longestFrameMs: 33.6,
};

describe("turnLogSection", () => {
  it("says whether the browser has view transitions, and that no move has run yet", () => {
    expect(turnLogSection([], false, "turn").lines).toEqual([
      ["View transitions", "no"],
      ["Motion", "turn"],
      ["Moves", "none yet"],
    ]);
  });

  it("describes each move: its way, its outcome, its frames and its animations, counted", () => {
    const skipped: TurnRecord = { ...turn, way: "back", zoom: "out", animations: [], outcome: "skipped", error: "AbortError", ms: null, frames: 0 };
    expect(turnLogSection([turn, skipped], true, "turn").lines.slice(2)).toEqual([
      ["Move 1", "/dashboard/library → /dashboard/bookstore: forward; finished; 452 ms, 27 frames, longest 34 ms; turn-fold-right, turn-open-right, camera ×2"],
      ["Move 2", "/dashboard/library → /dashboard/bookstore: back, zoom out; skipped (AbortError); 0 frames; no animations"],
    ]);
  });
});
