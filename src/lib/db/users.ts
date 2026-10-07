import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/types/database";
import type { AppUser } from "@/types/user";

type ProfileRow = Tables<"profiles">;

type CurrentUserOptions = {
  userId: string;
  email?: string | null;
};

function mapProfileToUser(profile: ProfileRow | null, options: CurrentUserOptions): AppUser {
  const displayName =
    profile?.username ??
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
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", options.userId)
    .maybeSingle();

  return mapProfileToUser(profile ?? null, options);
}

// The functions below use Supabase's admin API (service role). Public sign-up is turned off
// in Supabase, so this is the only way an account is made or a password is set without the
// owner being signed in. Supabase Auth owns the password hashes.

/**
 * Creates an account that can sign in straight away, and its profile row. The user is
 * created already confirmed because Supabase's built-in email only reaches the project
 * team. Returns the new user's id, and throws if the account can't be created (for example
 * when the email is already registered, or the sign-up trigger refuses the username).
 */
export async function createConfirmedUser(input: {
  email: string;
  password: string;
  username: string;
}): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { username: input.username },
  });

  if (error) throw error;

  // The account works without a profile (see mapProfileToUser), so this doesn't fail it.
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    username: input.username,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    console.error("Profile row was not written for a new account.", profileError);
  }

  return data.user.id;
}

/**
 * True when a profile already has this username, ignoring case, as the database's unique
 * index does. Usernames are letters, digits, "_" and "-", so "_" is the only character
 * `ilike` would read as a pattern, and it is escaped.
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1);

  if (error) throw error;
  return data.length > 0;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });

  if (error) throw error;
}

const USERS_PER_PAGE = 200;

/** The id of the account with this email, or null. It reads the user list page by page. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const wanted = email.trim().toLowerCase();

  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < USERS_PER_PAGE) return null;
  }
}
