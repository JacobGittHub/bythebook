import { getAuthenticatedUser } from "@/lib/supabase";
import { createBook, listBooks } from "@/lib/db/openings";
import { libraryErrorResponse } from "@/lib/library/http";
import { createBookSchema } from "@/lib/validators/schemas";
import { recordUsage } from "@/lib/db/usage";

/** The viewer's books without their trees, newest change first. */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "books_read");

  try {
    return Response.json({ books: await listBooks(user.id) });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "books_write");

  const parsed = createBookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid book.", code: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await createBook(user.id, parsed.data), { status: 201 });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}
