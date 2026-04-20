import {
  auth,
  getSessionUserEmail,
  getSessionUserId,
  getSessionUserName,
} from "@/lib/auth";
import { getCurrentUser } from "@/lib/db/users";
import { userPreferencesSchema } from "@/lib/validators/schemas";

export async function GET() {
  const session = await auth();
  const userId = getSessionUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    user: await getCurrentUser({
      userId,
      email: getSessionUserEmail(session),
      name: getSessionUserName(session),
    }),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = getSessionUserId(session);

  if (!userId) {
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
