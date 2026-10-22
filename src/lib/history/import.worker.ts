// The import's Web Worker (D13): a thin shell over the two passes in `importFile.ts`, so reading
// and replaying a file never holds up the page. It refuses a file before reading it when it is too
// large or compressed, and reads it as a stream each pass. The page (`importSession.ts`) stops it
// with `terminate()` on Cancel or past the time limit.

import { fileProblem, importGames, pickGames, scanFile, type Candidate } from "./importFile";
import type { ImportReply, ImportRequest } from "./importSession";

type WorkerScope = {
  onmessage: ((event: MessageEvent<ImportRequest>) => void) | null;
  postMessage(message: ImportReply): void;
};
const scope = self as unknown as WorkerScope;
const post = (reply: ImportReply) => scope.postMessage(reply);

/** What the first pass leaves for the second. */
let scanned: { file: File; storedKeys: Set<string>; candidates: Candidate[]; games: number } | null = null;

async function handle(request: ImportRequest) {
  if (request.kind === "scan") {
    const { file } = request;
    const problem = fileProblem(file.name, file.size, new Uint8Array(await file.slice(0, 4).arrayBuffer()));
    if (problem) return post({ kind: "failed", message: problem });
    const storedKeys = new Set(request.storedKeys);
    const { scan, candidates } = await scanFile(file.stream(), storedKeys, (bytes) =>
      post({ kind: "progress", pass: "scan", done: bytes, total: file.size }),
    );
    scanned = { file, storedKeys, candidates, games: scan.games };
    return post({ kind: "scanned", scan });
  }

  if (!scanned) return post({ kind: "failed", message: "Choose a file first." });
  const { file, storedKeys, candidates, games } = scanned;
  const wanted = pickGames(candidates, request.username, request.keep);
  const result = await importGames(file.stream(), { username: request.username, wanted, storedKeys }, (done) =>
    post({ kind: "progress", pass: "import", done, total: games }),
  );
  post({ kind: "imported", result });
}

scope.onmessage = (event) => {
  handle(event.data).catch((error: unknown) => {
    console.error("The import failed.", error);
    post({ kind: "failed", message: "The file couldn't be read. Is it a PGN file?" });
  });
};
