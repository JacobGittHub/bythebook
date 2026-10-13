"use client";

import { BoardInteractive } from "@/components/board/BoardInteractive";
import { Button } from "@/components/shadcn/button";
import { Panel } from "@/components/ui/Panel";

/**
 * Puzzle trainer composition.
 * Board + controls. Viewport-fitting: no page scroll.
 * Puzzle loading and solution validation will be wired
 * when the puzzles table is populated.
 */
export function PuzzleBoard() {
  return (
    <div className="grid h-[calc(100vh-10rem)] gap-3 lg:grid-cols-[1.1fr_0.9fr]">
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
      <div className="flex flex-col gap-2 overflow-y-auto">
        <Panel className="px-3 py-2">
          <h3 className="font-heading font-semibold">Puzzle trainer</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Solve tactical puzzles to sharpen your pattern recognition.
            Puzzles will be loaded from the database.
          </p>
        </Panel>
        <div className="flex gap-2">
          <Button size="sm">Solve puzzle</Button>
          <Button size="sm" variant="outline">Next puzzle</Button>
          <Button size="sm" variant="ghost">Show hint</Button>
        </div>
      </div>
    </div>
  );
}
