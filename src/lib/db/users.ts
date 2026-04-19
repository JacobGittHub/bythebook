import type { AppUser } from "@/types/user";

export async function getCurrentUser(): Promise<AppUser> {
  return {
    id: "demo-user",
    email: "player@example.com",
    displayName: "Demo Player",
    preferences: {
      boardTheme: "classic",
      autoFlipForBlack: true,
      showEngine: true,
    },
  };
}
