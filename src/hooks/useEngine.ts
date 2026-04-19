"use client";

import { useEffect, useState } from "react";
import { EngineWorkerManager, type EngineEvaluation } from "@/components/board/EngineWorker";

export function useEngine(fen: string) {
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);

  useEffect(() => {
    const manager = new EngineWorkerManager();
    manager.evaluate(fen).then(setEvaluation);
  }, [fen]);

  return evaluation;
}
