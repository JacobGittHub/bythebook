import { createAdminSupabaseClient } from "@/lib/supabase";

/** What a counted call was for. `lichess` is a live Lichess request; the rest are route handlers. */
export type UsageKind =
  | "explorer"
  | "lichess"
  | "books_read"
  | "books_write"
  | "sessions"
  | "puzzles"
  | "user";

/**
 * Adds one to today's count for this user and kind in `usage_counters`, and returns the new
 * count. A null user is the row all guests share, except where `E2E_USAGE_USER_ID` is set
 * (CI): there guest calls count against the test account, so test runs stay out of real
 * guest numbers. Counting never fails a request: on an error it logs and returns null.
 */
export async function recordUsage(
  userId: string | null,
  kind: UsageKind,
): Promise<number | null> {
  const countedUser = userId ?? process.env.E2E_USAGE_USER_ID ?? null;
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc("increment_usage", {
      p_kind: kind,
      ...(countedUser ? { p_user_id: countedUser } : {}),
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Usage count failed for "${kind}".`, error);
    return null;
  }
}
