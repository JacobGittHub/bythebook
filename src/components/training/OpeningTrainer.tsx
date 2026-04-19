import { BoardControls } from "@/components/board/BoardControls";
import { ChessBoard } from "@/components/board/ChessBoard";
import { MoveTree } from "@/components/training/MoveTree";
import { SessionSummary } from "@/components/training/SessionSummary";
import type { OpeningBook } from "@/types/chess";

const fallbackResult = {
  accuracy: 88,
  completedLines: 5,
  mistakes: ["Move order slip on move 7"],
};

export function OpeningTrainer({ book }: { book: OpeningBook }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <ChessBoard fen={book.rootFen} />
        <BoardControls />
      </div>
      <div className="space-y-4">
        <MoveTree book={book} />
        <SessionSummary result={fallbackResult} />
      </div>
    </div>
  );
}
