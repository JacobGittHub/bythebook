// Debug mode: who sees the "Copy bug report" button (plans/testing.md, D9). It is set by
// server-only environment variables, so the list never reaches the browser.
import type { Viewer } from "@/lib/auth/viewer";

export type DebugEnv = {
  /** "true" turns debug mode on. Anything else, or nothing, leaves it off for everyone. */
  DEBUG_MODE?: string;
  /** Comma-separated account emails that get debug mode on a deployed site. */
  DEBUG_EMAILS?: string;
  NODE_ENV?: string;
};

/**
 * Whether this viewer gets debug mode. Under `next dev` the flag alone turns it on for
 * everyone, guests included. Deployed, it also needs a signed-in account whose email is on
 * `DEBUG_EMAILS`. Emails are used because they are unique, and usernames aren't.
 */
export function canDebug(viewer: Viewer, env: DebugEnv = process.env): boolean {
  if (env.DEBUG_MODE?.trim().toLowerCase() !== "true") return false;
  if (env.NODE_ENV === "development") return true;
  if (!viewer.signedIn || !viewer.email) return false;

  const email = viewer.email.trim().toLowerCase();
  return (env.DEBUG_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === email);
}
