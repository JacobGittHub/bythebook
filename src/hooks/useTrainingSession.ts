"use client";

import { useCallback, useState } from "react";
import { findChildMoveNodeByUci, findMoveNodeById } from "@/lib/chess/moveTree";
import { useChessGame } from "./useChessGame";
import type { MoveResult } from "./useChessGame";
import type { OpeningBook } from "@/types/chess";

type TrainingStatus = "idle" | "active" | "complete";

type TrainingSessionState = {
  status: TrainingStatus;
  currentNodeId: string;
  correctMoves: number;
  totalMoves: number;
  mistakes: string[];
};

const initialSessionState: TrainingSessionState = {
  status: "idle",
  currentNodeId: "root",
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

      const currentNode =
        findMoveNodeById(book.moveNode, session.currentNodeId) ?? book.moveNode;
      const matchingChild = findChildMoveNodeByUci(currentNode, move.uci);

      if (!matchingChild) {
        setSession((prev) => ({
          ...prev,
          status: "complete",
          totalMoves: prev.totalMoves + 1,
          mistakes: [...prev.mistakes, move.san],
        }));
        return;
      }

      setSession((prev) => ({
        ...prev,
        currentNodeId: matchingChild.id,
        totalMoves: prev.totalMoves + 1,
        correctMoves: prev.correctMoves + 1,
        status: matchingChild.children.length === 0 ? "complete" : prev.status,
      }));
    },
    [book.moveNode, session.currentNodeId, session.status]
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
