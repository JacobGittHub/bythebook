// An import in progress, from the page's side (D13): it starts the import worker
// (`import.worker.ts`), asks it for each pass, and stops it on Cancel or when a pass runs past
// `IMPORT_TIME_LIMIT_MS`. The worker keeps the file and the first pass's candidates between the
// passes, so the page sends only the user's choices.

import type { FileScan, ImportResult } from "./importFile";
import { HistoryError, IMPORT_TIME_LIMIT_MS } from "./types";

export type ImportRequest =
  | { kind: "scan"; file: File; storedKeys: string[] }
  | { kind: "import"; username: string; keep: number };

/** How far a pass has gone: bytes of the file in the first, games in the second. */
export type ImportProgress = { pass: "scan" | "import"; done: number; total: number };

export type ImportReply =
  | ({ kind: "progress" } & ImportProgress)
  | { kind: "scanned"; scan: FileScan }
  | { kind: "imported"; result: ImportResult }
  | { kind: "failed"; message: string };

/** A pass that didn't finish because the user cancelled it, or it ran too long. */
export class ImportStopped extends Error {
  constructor(readonly reason: "cancelled" | "timeout") {
    super(reason === "timeout" ? "The import took too long and was stopped." : "The import was cancelled.");
    this.name = "ImportStopped";
  }
}

export type ImportSession = {
  /** The first pass over `file`, counting as duplicates the games already stored. */
  scan(file: File, storedKeys: Iterable<string>, onProgress?: (progress: ImportProgress) => void): Promise<FileScan>;
  /** The second pass: the newest `keep` new games that `username` played, read into records. */
  read(username: string, keep: number, onProgress?: (progress: ImportProgress) => void): Promise<ImportResult>;
  /** Stops the worker; a pass in progress fails with `ImportStopped`. Call it when the import is done, too. */
  stop(): void;
};

type Pending = {
  resolve: (reply: ImportReply) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: ImportProgress) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function startImportSession(): ImportSession {
  const worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
  let pending: Pending | null = null;
  let stopped = false;

  const settle = (): Pending | null => {
    const current = pending;
    pending = null;
    if (current) clearTimeout(current.timer);
    return current;
  };

  const stop = (reason: ImportStopped["reason"]) => {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    settle()?.reject(new ImportStopped(reason));
  };

  worker.onmessage = (event: MessageEvent<ImportReply>) => {
    const reply = event.data;
    if (reply.kind === "progress") {
      pending?.onProgress?.(reply);
      return;
    }
    const current = settle();
    if (!current) return;
    if (reply.kind === "failed") current.reject(new HistoryError("invalid", reply.message));
    else current.resolve(reply);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    console.error("The import worker failed.", event.message);
    settle()?.reject(new HistoryError("failed", "The import stopped unexpectedly. Please try again."));
  };

  function ask(request: ImportRequest, onProgress?: (progress: ImportProgress) => void): Promise<ImportReply> {
    if (stopped) return Promise.reject(new ImportStopped("cancelled"));
    if (pending) return Promise.reject(new HistoryError("failed", "The import is already reading."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop("timeout"), IMPORT_TIME_LIMIT_MS);
      pending = { resolve, reject, onProgress, timer };
      worker.postMessage(request);
    });
  }

  return {
    async scan(file, storedKeys, onProgress) {
      const reply = await ask({ kind: "scan", file, storedKeys: [...storedKeys] }, onProgress);
      if (reply.kind !== "scanned") throw new HistoryError("failed");
      return reply.scan;
    },
    async read(username, keep, onProgress) {
      const reply = await ask({ kind: "import", username, keep }, onProgress);
      if (reply.kind !== "imported") throw new HistoryError("failed");
      return reply.result;
    },
    stop: () => stop("cancelled"),
  };
}
