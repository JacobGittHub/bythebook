import { cache } from "react";
import { getAuthenticatedUser } from "@/lib/supabase";

/** Who is looking at a page. A guest has no account or is signed out. */
export type Viewer =
  | { signedIn: false }
  | { signedIn: true; userId: string; displayName: string; email: string | null };

/**
 * The viewer of the current request. It is cached for the length of one render, so the
 * layout and the page share a single check with Supabase. The name comes from the sign-up
 * metadata, which avoids a database read.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getAuthenticatedUser();
  if (!user) return { signedIn: false };

  const username: unknown = user.user_metadata?.username;
  const displayName =
    typeof username === "string" && username.trim()
      ? username.trim()
      : (user.email?.split("@")[0] ?? "Player");

  return { signedIn: true, userId: user.id, displayName, email: user.email ?? null };
});
