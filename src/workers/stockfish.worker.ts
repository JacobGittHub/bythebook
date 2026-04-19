export type WorkerRequest = {
  type: "analyze";
  fen: string;
};

export function handleWorkerRequest(request: WorkerRequest) {
  return {
    received: request.type,
    fen: request.fen,
  };
}
