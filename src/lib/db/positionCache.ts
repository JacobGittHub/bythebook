import { z } from "zod";
import { toPositionKey } from "@/lib/chess/fen";
import { createAdminSupabaseClient } from "@/lib/supabase";
import type { ExplorerResponse } from "@/types/chess";

const explorerMoveSchema = z.object({
  san: z.string(),
  uci: z.string(),
  white: z.number(),
  draws: z.number(),
  black: z.number(),
});

// Keep in step with ExplorerResponse: z.object drops any key not listed here.
const explorerResponseSchema = z.object({
  moves: z.array(explorerMoveSchema),
  opening: z
    .object({
      eco: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  totals: z
    .object({
      white: z.number(),
      draws: z.number(),
      black: z.number(),
    })
    .optional(),
  movesLimit: z.number().optional(),
});

// Rows are keyed by toPositionKey(fen), so move orders that reach one position share a row.
// Both functions use the admin client: guests have no session to read with, and the table
// holds nothing private.

export async function getCachedPosition(fen: string): Promise<ExplorerResponse | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("position_cache")
    .select("explorer_data")
    .eq("position_key", toPositionKey(fen))
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const parsed = explorerResponseSchema.safeParse(data.explorer_data);
  return parsed.success ? parsed.data : null;
}

export async function setCachedPosition(fen: string, value: ExplorerResponse) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("position_cache").upsert({
    position_key: toPositionKey(fen),
    explorer_data: value,
    cached_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}
