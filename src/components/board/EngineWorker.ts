export type EngineEvaluation = {
  depth: number;
  score: string;
  bestMove?: string;
};

export class EngineWorkerManager {
  async evaluate(fen: string): Promise<EngineEvaluation> {
    return {
      depth: 12,
      score: "0.20",
      bestMove: fen ? "e2e4" : undefined,
    };
  }
}
