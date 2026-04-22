import { createServerSupabaseClient } from "@/lib/supabase";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines, isMove, parseMoveNode } from "@/lib/chess/moveTree";
import type { Json, Tables } from "@/types/database";
import type { Move, OpeningBook } from "@/types/chess";

type OpeningBookRow = Tables<"opening_books">;
type OpeningBookRowWithRuntimeMoveNode = OpeningBookRow & {
  move_node?: Json;
  moves?: Json;
};

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
  const runtimeRow = row as OpeningBookRowWithRuntimeMoveNode;
  const storedMoveTree = runtimeRow.move_node;
  const legacyLines = parseMoveLines(runtimeRow.moves ?? []);
  const moveNode =
    storedMoveTree !== undefined
      ? parseMoveNode(storedMoveTree, START_FEN)
      : buildMoveTreeFromLines(legacyLines, START_FEN);

  return {
    id: row.id,
    name: row.name,
    color: row.color === "black" ? "black" : "white",
    description: row.is_public ? "Public repertoire" : "Private repertoire",
    rootFen: moveNode.fen,
    moveNode,
  };
}

export async function listOpeningBooks(): Promise<OpeningBook[]> {
  const supabase = await createServerSupabaseClient();
  const query = supabase
    .from("opening_books")
    .select("*")
    .order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapOpeningBook);
}

export async function getOpeningBook(bookId: string): Promise<OpeningBook | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_books")
    .select("*")
    .eq("id", bookId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapOpeningBook(data);
}
