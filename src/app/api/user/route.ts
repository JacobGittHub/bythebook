import { getCurrentUser } from "@/lib/db/users";

export async function GET() {
  return Response.json({ user: await getCurrentUser() });
}

export async function PATCH() {
  return Response.json({ message: "Update user preferences placeholder" });
}
