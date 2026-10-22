import { getAuthenticatedUser } from "@/lib/supabase";
import { readChunk, stageChunk } from "@/lib/db/gameHistory";
import { historyErrorResponse } from "@/lib/history/http";
import { storedChunkSchema } from "@/lib/history/types";
import { stageHistoryChunkSchema } from "@/lib/validators/schemas";
import { recordUsage } from "@/lib/db/usage";

type Params = { params: Promise<{ n: string }> };

/** The chunk number in the path, or null when it isn't one. */
async function chunkNumber(params: Params["params"]): Promise<number | null> {
  const { n } = await params;
  const parsed = storedChunkSchema.shape.n.safeParse(/^\d{1,10}$/.test(n) ? Number(n) : NaN);
  return parsed.success ? parsed.data : null;
}

/** One stored chunk of the viewer's games, with their clocks. */
export async function GET(_req: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_read");

  const n = await chunkNumber(params);
  if (n === null) return Response.json({ error: "Not found", code: "invalid" }, { status: 404 });
  try {
    const chunk = await readChunk(user.id, n);
    if (!chunk) return Response.json({ error: "Not found", code: "invalid" }, { status: 404 });
    return Response.json(chunk);
  } catch (error) {
    return historyErrorResponse(error);
  }
}

/** Stages one chunk of a write planned from `expectedVersion`, until `POST /api/history` commits it. */
export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "history_write");

  const n = await chunkNumber(params);
  const parsed = stageHistoryChunkSchema.safeParse(await request.json().catch(() => null));
  if (n === null || !parsed.success) {
    return Response.json({ error: "Some of the games aren't valid, so nothing was saved.", code: "invalid" }, { status: 400 });
  }

  try {
    await stageChunk(user.id, n, parsed.data.expectedVersion, parsed.data.games);
    return new Response(null, { status: 204 });
  } catch (error) {
    return historyErrorResponse(error);
  }
}
