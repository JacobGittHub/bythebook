import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
});

const isDevelopment = process.env.NODE_ENV !== "production";

const providers = isDevelopment
  ? [
      Credentials({
        name: "Development Access",
        credentials: {
          username: {
            label: "Username",
            type: "text",
            placeholder: "existing profile username",
          },
        },
        async authorize(rawCredentials) {
          const parsedCredentials = credentialsSchema.safeParse(rawCredentials);

          if (!parsedCredentials.success) {
            return null;
          }

          const supabase = createAdminSupabaseClient();
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("id, username")
            .eq("username", parsedCredentials.data.username)
            .maybeSingle();

          if (error || !profile) {
            return null;
          }

          return {
            id: profile.id,
            name: profile.username,
            email: `${profile.username}@local.bythebook.dev`,
          };
        },
      }),
    ]
  : [];

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  (isDevelopment ? "bythebook-development-secret" : undefined);

export const authConfig = {
  secret: authSecret,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }

      return session;
    },
  },
} satisfies Parameters<typeof NextAuth>[0];

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export function getSessionUserId(session: Session | null) {
  return session?.user?.id ?? null;
}

export function getSessionUserEmail(session: Session | null) {
  return session?.user?.email ?? null;
}

export function getSessionUserName(session: Session | null) {
  return session?.user?.name ?? null;
}

export function isDevelopmentCredentialsEnabled() {
  return providers.length > 0;
}
