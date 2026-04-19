import { listPuzzles } from "@/lib/db/puzzles";

export async function GET() {
  return Response.json({ puzzles: await listPuzzles() });
}

export async function POST() {
  return Response.json(
    { message: "Record puzzle attempt placeholder" },
    { status: 201 },
  );
}
