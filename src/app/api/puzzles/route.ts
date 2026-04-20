import { auth, getSessionUserId } from "@/lib/auth";
import { listPuzzles } from "@/lib/db/puzzles";

export async function GET() {
  const session = await auth();
  const userId = getSessionUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ puzzles: await listPuzzles() });
}

export async function POST() {
  const session = await auth();
  const userId = getSessionUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    { message: "Puzzle attempt writes are not implemented yet." },
    { status: 501 },
  );
}
