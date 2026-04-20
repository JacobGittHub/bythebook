import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

export type Puzzle = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  popularity: number | null;
};

type PuzzleRow = Tables<"puzzles">;

function mapPuzzle(row: PuzzleRow): Puzzle {
  return {
    id: row.id,
    fen: row.fen,
    moves: row.moves,
    rating: row.rating,
    themes: row.themes,
    popularity: row.popularity,
  };
}

export async function listPuzzles(limit = 25): Promise<Puzzle[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("puzzles")
    .select("*")
    .order("rating", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(mapPuzzle);
}
