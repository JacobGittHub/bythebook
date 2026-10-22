// How the history routes report a `HistoryError`, and how the account's store reads it back
// (plans/game-history.md, step 12): the status, and the code in the body as `{ error, code }`.

import { HistoryError, type HistoryErrorCode } from "./types";

export const HISTORY_ERROR_STATUS: Record<HistoryErrorCode, number> = {
  invalid: 400,
  stale: 409,
  failed: 500,
};

/** The route's response to an error thrown by `src/lib/db/gameHistory.ts`. */
export function historyErrorResponse(error: unknown): Response {
  const known = error instanceof HistoryError ? error : new HistoryError("failed", "The games couldn't be saved.");
  if (known !== error) console.error("A history route failed.", error);
  return Response.json({ error: known.message, code: known.code }, { status: HISTORY_ERROR_STATUS[known.code] });
}

/** The error a failed response carries, for the client. */
export async function historyErrorFrom(response: Response): Promise<HistoryError> {
  const body: unknown = await response.json().catch(() => null);
  const code = typeof body === "object" && body && "code" in body ? body.code : null;
  const message = typeof body === "object" && body && "error" in body ? body.error : null;
  const known = Object.keys(HISTORY_ERROR_STATUS).includes(String(code)) ? (code as HistoryErrorCode) : "failed";
  return new HistoryError(known, typeof message === "string" ? message : "The server couldn't keep the games.");
}
