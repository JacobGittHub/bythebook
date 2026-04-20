import { getAuthenticatedUser } from "@/lib/supabase";
import { listPuzzles } from "@/lib/db/puzzles";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ puzzles: await listPuzzles() });
}

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    { message: "Puzzle attempt writes are not implemented yet." },
    { status: 501 },
  );
}
