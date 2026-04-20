import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";
import type { AppUser } from "@/types/user";

type ProfileRow = Tables<"profiles">;

type CurrentUserOptions = {
  userId: string;
  email?: string | null;
  name?: string | null;
};

function mapProfileToUser(profile: ProfileRow | null, options: CurrentUserOptions): AppUser {
  const displayName =
    profile?.username ??
    options.name?.trim() ??
    options.email?.split("@")[0] ??
    "Player";

  return {
    id: options.userId,
    email: options.email ?? `${displayName.toLowerCase()}@local.bythebook.dev`,
    displayName,
    preferences: {
      boardTheme: "classic",
      autoFlipForBlack: true,
      showEngine: true,
    },
  };
}

export async function getCurrentUser(options: CurrentUserOptions): Promise<AppUser> {
  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", options.userId)
    .maybeSingle();

  return mapProfileToUser(profile ?? null, options);
}
