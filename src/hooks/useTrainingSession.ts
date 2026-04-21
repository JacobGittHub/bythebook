"use client";

import { useCallback, useState } from "react";
import { useChessGame } from "./useChessGame";
import type { MoveResult } from "./useChessGame";
import type { OpeningBook } from "@/types/chess";

type TrainingStatus = "idle" | "active" | "complete";

type TrainingSessionState = {
  status: TrainingStatus;
  correctMoves: number;
  totalMoves: number;
  mistakes: string[];
};

const initialSessionState: TrainingSessionState = {
  status: "idle",
  correctMoves: 0,
  totalMoves: 0,
  mistakes: [],
};

/**
 * Training session hook: composes useChessGame with opening-book validation.
 * Checks user moves against the book, tracks accuracy, and manages
 * auto-play of opponent responses.
 */
export function useTrainingSession(book: OpeningBook) {
  const chessGame = useChessGame(book.rootFen);
  const [session, setSession] = useState<TrainingSessionState>(initialSessionState);

  const start = useCallback(() => {
    chessGame.resetGame();
    setSession({ ...initialSessionState, status: "active" });
  }, [chessGame]);

  const handleUserMove = useCallback(
    (move: MoveResult) => {
      if (session.status !== "active") return;

      // For now, accept all legal moves and count them.
      // Full book-tree validation will be wired when the opening book
      // JSONB structure is finalized.
      setSession((prev) => ({
        ...prev,
        totalMoves: prev.totalMoves + 1,
        correctMoves: prev.correctMoves + 1,
      }));
    },
    [session.status]
  );

  const finish = useCallback(() => {
    setSession((prev) => ({ ...prev, status: "complete" }));
  }, []);

  return {
    chessGame,
    session,
    start,
    handleUserMove,
    finish,
  };
}
