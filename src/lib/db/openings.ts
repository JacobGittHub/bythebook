import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/database";
import type { Move, OpeningBook } from "@/types/chess";

type OpeningBookRow = Tables<"opening_books">;

function isMove(value: Json | undefined): value is Move {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.san === "string" &&
      typeof value.uci === "string",
  );
}

function parseMoveLines(value: Json): Move[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((line) => {
      if (!Array.isArray(line)) {
        return null;
      }

      const moves = line.filter(isMove);
      return moves.length > 0 ? moves : null;
    })
    .filter((line): line is Move[] => line !== null);
}

function mapOpeningBook(row: OpeningBookRow): OpeningBook {
  return {
    id: row.id,
    name: row.name,
    color: row.color === "black" ? "black" : "white",
    description: row.is_public ? "Public repertoire" : "Private repertoire",
    rootFen: "startpos",
    lines: parseMoveLines(row.moves),
  };
}

export async function listOpeningBooks(userId?: string): Promise<OpeningBook[]> {
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("opening_books")
    .select("*")
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (userId) {
    query = query.or(`user_id.eq.${userId},is_public.eq.true`);
  } else {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapOpeningBook);
}

export async function getOpeningBook(
  bookId: string,
  userId?: string,
): Promise<OpeningBook | null> {
  const supabase = createAdminSupabaseClient();

  let query = supabase.from("opening_books").select("*").eq("id", bookId);

  if (userId) {
    query = query.or(`user_id.eq.${userId},is_public.eq.true`);
  } else {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapOpeningBook(data);
}
