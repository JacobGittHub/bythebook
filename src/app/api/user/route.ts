import { getCurrentUser } from "@/lib/db/users";
import { getAuthenticatedUser } from "@/lib/supabase";
import { userPreferencesSchema } from "@/lib/validators/schemas";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    user: await getCurrentUser({
      userId: user.id,
      email: user.email,
    }),
  });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsedPayload = userPreferencesSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return Response.json(
      { error: "Invalid user preferences payload", issues: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  return Response.json(
    { message: "User preference writes are not implemented yet." },
    { status: 501 },
  );
}
