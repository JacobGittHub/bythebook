import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";
import type { Session } from "@/types/training";

type TrainingSessionRow = Tables<"training_sessions">;

function mapTrainingSession(row: TrainingSessionRow): Session {
  const accuracy =
    row.correct_moves !== null &&
    row.total_moves !== null &&
    row.total_moves > 0
      ? Math.round((row.correct_moves / row.total_moves) * 100)
      : 0;

  return {
    id: row.id,
    bookId: row.book_id ?? "",
    startedAt: row.created_at ?? new Date(0).toISOString(),
    result: {
      accuracy,
      completedLines: row.total_moves ?? 0,
      mistakes:
        row.result === "fail" ? ["Training session marked as failed."] : [],
    },
  };
}

export async function listSessions(userId: string): Promise<Session[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapTrainingSession);
}
