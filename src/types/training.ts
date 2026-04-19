export type SessionResult = {
  accuracy: number;
  completedLines: number;
  mistakes: string[];
};

export type Session = {
  id: string;
  bookId: string;
  startedAt: string;
  completedAt?: string;
  result?: SessionResult;
};

export type TrainingState = {
  currentFen: string;
  moveHistory: string[];
  status: "idle" | "active" | "complete";
};
