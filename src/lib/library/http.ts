// How the book routes report a `LibraryError`, and how the account store reads it back
// (plans/deployment.md Phase 5): the status, and the code in the body as `{ error, code }`.

import { LibraryError, type LibraryErrorCode } from "./types";

export const LIBRARY_ERROR_STATUS: Record<LibraryErrorCode, number> = {
  invalid: 400,
  over_limit: 400,
  not_found: 404,
  stale: 409,
  full: 409,
  failed: 500,
};

/** The route's response to an error thrown by `src/lib/db/openings.ts`. */
export function libraryErrorResponse(error: unknown): Response {
  const known = error instanceof LibraryError ? error : new LibraryError("failed");
  if (known !== error) console.error("A book route failed.", error);
  return Response.json({ error: known.message, code: known.code }, { status: LIBRARY_ERROR_STATUS[known.code] });
}

/** The error a failed response carries, for the client. */
export async function libraryErrorFrom(response: Response): Promise<LibraryError> {
  const body: unknown = await response.json().catch(() => null);
  const code = typeof body === "object" && body && "code" in body ? body.code : null;
  const message = typeof body === "object" && body && "error" in body ? body.error : null;
  const known = Object.keys(LIBRARY_ERROR_STATUS).includes(String(code)) ? (code as LibraryErrorCode) : "failed";
  return new LibraryError(known, typeof message === "string" ? message : known);
}
