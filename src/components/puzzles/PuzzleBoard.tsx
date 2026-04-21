"use client";

import { BoardInteractive } from "@/components/board/BoardInteractive";
import { Button } from "@/components/ui/Button";

/**
 * Puzzle trainer composition.
 * Board + controls. Viewport-fitting: no page scroll.
 * Puzzle loading and solution validation will be wired
 * when the puzzles table is populated.
 */
export function PuzzleBoard() {
  return (
    <div className="grid h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Board column */}
      <div className="flex items-center justify-center">
        <div className="h-full max-h-full w-auto" style={{ aspectRatio: "1/1" }}>
          <BoardInteractive
            orientation="white"
            playerColor="both"
          />
        </div>
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Puzzle trainer
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Solve tactical puzzles to sharpen your pattern recognition.
            Puzzles will be loaded from the database.
          </p>
        </div>
        <div className="flex gap-3">
          <Button>Solve puzzle</Button>
          <Button variant="secondary">Next puzzle</Button>
          <Button variant="ghost">Show hint</Button>
        </div>
      </div>
    </div>
  );
}
