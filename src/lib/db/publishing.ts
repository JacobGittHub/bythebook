// The publishing account's drafts (plans/bookstore.md D7, D13), written by local scripts with
// the service role, never by the app: a draft is a private book in that account's library,
// where the user reviews, renames and later publishes it. Writes validate and summarize as
// the account library's do (`openings.ts`).

import { createAdminSupabaseClient } from "@/lib/supabase";
import { checkBookName } from "@/lib/library/names";
import { summarize } from "@/lib/library/summary";
import { checkedTrees } from "@/lib/library/writes";
import type { BookSide } from "@/lib/books/measures";
import type { Json } from "@/types/database";
import type { MoveNode } from "@/types/chess";

/** The longest a book's description may be (bookstore.md D8). */
export const MAX_BOOK_DESCRIPTION = 200;

export type Draft = { name: string; color: BookSide; description: string; trees: MoveNode[] };

/** The account's username, for a script to say whose library it wrote to. */
export async function usernameOf(userId: string): Promise<string | null> {
  const { data, error } = await createAdminSupabaseClient().from("profiles").select("username").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

/** The account's books by name, ignoring case, so a rerun replaces its own drafts. */
export async function bookIdsByName(userId: string): Promise<Map<string, string>> {
  const { data, error } = await createAdminSupabaseClient().from("opening_books").select("id, name").eq("user_id", userId);
  if (error) throw error;
  return new Map(data.map((row) => [row.name.toLocaleLowerCase(), row.id]));
}

/** The account's book with this name, ignoring case, as a draft with its last change; null when there is none. */
export async function draftByName(userId: string, name: string): Promise<(Draft & { updatedAt: string }) | null> {
  const { data, error } = await createAdminSupabaseClient()
    .from("opening_books")
    .select("name, color, description, trees, updated_at")
    .eq("user_id", userId)
    .ilike("name", name.replace(/[\\%_]/g, (char) => `\\${char}`))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name,
    color: data.color as BookSide,
    description: data.description ?? "",
    trees: checkedTrees(data.trees),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

/** Saves a draft as a new private book, or over the book `replaceId` names. Returns its id. */
export async function saveDraft(userId: string, draft: Draft, replaceId?: string): Promise<string> {
  const name = checkBookName(draft.name);
  if (!name) throw new Error(`"${draft.name}" can't be a book's name.`);
  if (draft.description.length > MAX_BOOK_DESCRIPTION) {
    throw new Error(`"${name}": its description is over ${MAX_BOOK_DESCRIPTION} characters.`);
  }
  const trees = checkedTrees(draft.trees);
  const row = {
    name,
    color: draft.color,
    description: draft.description,
    trees: trees as unknown as Json,
    summary: summarize(trees, draft.color) as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  const supabase = createAdminSupabaseClient();
  const { data, error } = replaceId
    ? await supabase.from("opening_books").update(row).eq("user_id", userId).eq("id", replaceId).select("id").single()
    : await supabase
        .from("opening_books")
        .insert({ ...row, user_id: userId, origin: { kind: "own" }, is_public: false })
        .select("id")
        .single();
  if (error) throw error;
  return data.id;
}
