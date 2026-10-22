import { getAuthenticatedUser } from "@/lib/supabase";
import { clearHistory, commitWrite, readSummary } from "@/lib/db/gameHistory";
import { historyErrorResponse } from "@/lib/history/http";
import { commitHistorySchema } from "@/lib/validators/schemas";
import { recordUsage } from "@/lib/db/usage";

// The viewer's game history (plans/game-history.md, step 12). A write sends its chunks to
// `chunks/[n]` first, then commits them here.

/** The summary, with the account's limit and its latest request for more room. */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_read");

  try {
    return Response.json(await readSummary(user.id));
  } catch (error) {
    return historyErrorResponse(error);
  }
}

/** Commits a write whose chunks were staged; refused with 409 if the history changed since `expectedVersion`. */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_write");

  const parsed = commitHistorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "The write isn't valid, so nothing was saved.", code: "invalid" }, { status: 400 });
  }

  const { expectedVersion, ...commit } = parsed.data;
  try {
    return Response.json(await commitWrite(user.id, expectedVersion, commit));
  } catch (error) {
    return historyErrorResponse(error);
  }
}

/** Deletes every game. */
export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_write");

  try {
    await clearHistory(user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return historyErrorResponse(error);
  }
}
