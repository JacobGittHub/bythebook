import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines, createRootMoveNode, isMove, parseMoveNode } from "@/lib/chess/moveTree";
import type { Json, Tables } from "@/types/database";
import type { Move, MoveNode, OpeningBook } from "@/types/chess";

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
  const stored = runtimeRow.move_node;

  // After the moves→move_node rename, legacy rows have an array of line arrays in
  // move_node. parseMoveNode rejects arrays, so detect and handle them here.
  const moveNode = Array.isArray(stored)
    ? buildMoveTreeFromLines(parseMoveLines(stored as Json), START_FEN)
    : parseMoveNode(stored, START_FEN);

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

export async function createOpeningBook(
  userId: string,
  input: { name: string; color: "white" | "black" },
): Promise<OpeningBook | null> {
  const supabase = createAdminSupabaseClient();
  const rootNode = createRootMoveNode(START_FEN);
  const { data, error } = await supabase
    .from("opening_books")
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color,
      move_node: rootNode as unknown as Json,
      is_public: false,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapOpeningBook(data);
}

export async function updateOpeningBookTree(
  bookId: string,
  moveNode: MoveNode,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("opening_books")
    .update({ move_node: moveNode as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", bookId);

  if (error) throw error;
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
