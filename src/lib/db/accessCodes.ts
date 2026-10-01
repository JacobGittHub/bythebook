import {
  generateAccessCode,
  hashAccessCode,
  type AccessCodePurpose,
} from "@/lib/auth/accessCode";
import { createAdminSupabaseClient } from "@/lib/supabase";

// Every function uses the admin client: `access_codes` has no policies, so only the service
// role can touch it.

/**
 * Stores a new code and returns it. This is the only time the code exists in readable form;
 * the table keeps its hash. A reset code needs the account it resets.
 */
export async function createAccessCode(
  purpose: AccessCodePurpose,
  userId: string | null = null,
): Promise<string> {
  const code = generateAccessCode();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("access_codes")
    .insert({ code_hash: hashAccessCode(code), purpose, user_id: userId });

  if (error) throw error;
  return code;
}

/**
 * Uses up a code. It is one conditional update, so of two requests with the same code only
 * one gets a row back. Returns null if the code doesn't exist, is for something else, or was
 * already used.
 */
export async function claimAccessCode(
  code: string,
  purpose: AccessCodePurpose,
): Promise<{ userId: string | null } | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("access_codes")
    .update({ claimed_at: new Date().toISOString() })
    .eq("code_hash", hashAccessCode(code))
    .eq("purpose", purpose)
    .is("claimed_at", null)
    .select("user_id")
    .maybeSingle();

  if (error) throw error;
  return data ? { userId: data.user_id } : null;
}

/** Makes a claimed code usable again, for when the step it paid for failed. */
export async function releaseAccessCode(code: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("access_codes")
    .update({ claimed_at: null })
    .eq("code_hash", hashAccessCode(code));

  if (error) throw error;
}

/** Records which account an invite code created. */
export async function setAccessCodeUser(code: string, userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("access_codes")
    .update({ user_id: userId })
    .eq("code_hash", hashAccessCode(code));

  if (error) throw error;
}

/** How many invite codes exist, and how many of them have been used. */
export async function countInviteCodes(): Promise<{ total: number; claimed: number }> {
  const supabase = createAdminSupabaseClient();
  const all = await supabase
    .from("access_codes")
    .select("*", { count: "exact", head: true })
    .eq("purpose", "invite");
  const used = await supabase
    .from("access_codes")
    .select("*", { count: "exact", head: true })
    .eq("purpose", "invite")
    .not("claimed_at", "is", null);

  if (all.error) throw all.error;
  if (used.error) throw used.error;
  return { total: all.count ?? 0, claimed: used.count ?? 0 };
}
