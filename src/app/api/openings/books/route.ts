import { getAuthenticatedUser } from "@/lib/supabase";
import { createOpeningBook, listOpeningBooks } from "@/lib/db/openings";
import { openingBookInputSchema } from "@/lib/validators/schemas";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ books: await listOpeningBooks() });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsedPayload = openingBookInputSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return Response.json(
      { error: "Invalid opening book payload", issues: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  const book = await createOpeningBook(user.id, {
    name: parsedPayload.data.name,
    color: parsedPayload.data.color,
  });

  if (!book) {
    return Response.json({ error: "Failed to create opening book." }, { status: 500 });
  }

  return Response.json(book, { status: 201 });
}
