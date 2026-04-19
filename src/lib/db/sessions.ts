import type { Session } from "@/types/training";

export async function listSessions(): Promise<Session[]> {
  return [
    {
      id: "session-1",
      bookId: "vienna-main",
      startedAt: new Date().toISOString(),
    },
  ];
}
