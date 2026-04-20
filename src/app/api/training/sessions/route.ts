import { getAuthenticatedUser } from "@/lib/supabase";
import { listSessions } from "@/lib/db/sessions";
import { sessionInputSchema } from "@/lib/validators/schemas";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ sessions: await listSessions(user.id) });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsedPayload = sessionInputSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return Response.json(
      { error: "Invalid training session payload", issues: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  return Response.json(
    { message: "Training session writes are not implemented yet." },
    { status: 501 },
  );
}
