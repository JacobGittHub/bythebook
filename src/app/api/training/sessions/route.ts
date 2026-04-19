import { listSessions } from "@/lib/db/sessions";

export async function GET() {
  return Response.json({ sessions: await listSessions() });
}

export async function POST() {
  return Response.json(
    { message: "Save session result placeholder" },
    { status: 201 },
  );
}
