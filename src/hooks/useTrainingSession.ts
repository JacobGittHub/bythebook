"use client";

import { useState } from "react";
import type { TrainingState } from "@/types/training";

const initialState: TrainingState = {
  currentFen: "startpos",
  moveHistory: [],
  status: "idle",
};

export function useTrainingSession() {
  const [state, setState] = useState<TrainingState>(initialState);

  function start() {
    setState({ ...initialState, status: "active" });
  }

  function pushMove(move: string) {
    setState((current) => ({
      ...current,
      moveHistory: [...current.moveHistory, move],
    }));
  }

  function finish() {
    setState((current) => ({ ...current, status: "complete" }));
  }

  return { state, start, pushMove, finish };
}
