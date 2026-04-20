import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase";
import type { ExplorerResponse } from "@/types/chess";

const explorerMoveSchema = z.object({
  san: z.string(),
  uci: z.string(),
  white: z.number(),
  draws: z.number(),
  black: z.number(),
});

const explorerResponseSchema = z.object({
  moves: z.array(explorerMoveSchema),
  opening: z
    .object({
      eco: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

export async function getCachedPosition(fen: string): Promise<ExplorerResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("position_cache")
    .select("explorer_data")
    .eq("fen", fen)
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
    fen,
    explorer_data: value,
    cached_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}
