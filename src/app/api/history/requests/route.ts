import { getAuthenticatedUser } from "@/lib/supabase";
import { requestRoom } from "@/lib/db/gameHistory";
import { historyErrorResponse } from "@/lib/history/http";
import { roomRequestSchema } from "@/lib/validators/schemas";
import { recordUsage } from "@/lib/db/usage";

/** Asks for room for more games (plans/game-history.md D37); one request may be pending at a time. */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_write");

  const parsed = roomRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ask for up to 50,000 games, with a reason of at most 200 characters.", code: "invalid" }, { status: 400 });
  }

  try {
    return Response.json(await requestRoom(user.id, parsed.data), { status: 201 });
  } catch (error) {
    return historyErrorResponse(error);
  }
}
