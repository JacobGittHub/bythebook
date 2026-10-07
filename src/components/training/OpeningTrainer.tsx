"use client";

import { BoardInteractive } from "@/components/board/BoardInteractive";
import { MoveTree } from "@/components/training/MoveTree";
import { SessionSummary } from "@/components/training/SessionSummary";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import type { LibraryBook } from "@/lib/library/types";

/**
 * Opening trainer composition.
 * Board (left) + move tree and session summary (right).
 * Viewport-fitting: the page never scrolls; side panels scroll internally.
 */
export function OpeningTrainer({ book }: { book: LibraryBook }) {
  const { session, handleUserMove, start, tree } = useTrainingSession(book);

  return (
    <div className="grid h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Board column — constrained to viewport height */}
      <div className="flex items-center justify-center">
        <div className="h-full max-h-full w-auto" style={{ aspectRatio: "1/1" }}>
          <BoardInteractive
            initialFen={tree.fen}
            orientation={book.color === "black" ? "black" : "white"}
            playerColor={book.color === "black" ? "black" : "white"}
            onMove={handleUserMove}
          />
        </div>
      </div>

      {/* Side panel — scrolls internally */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {session.status === "idle" && (
          <button
            onClick={start}
            className="btn-primary rounded-2xl px-6 py-3 text-sm font-medium transition-opacity"
          >
            Start training
          </button>
        )}
        <MoveTree book={book} />
        <SessionSummary
          result={{
            accuracy:
              session.totalMoves > 0
                ? Math.round(
                    (session.correctMoves / session.totalMoves) * 100
                  )
                : 0,
            completedLines: 0,
            mistakes: session.mistakes,
          }}
        />
      </div>
    </div>
  );
}
