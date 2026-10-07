import { getAuthenticatedUser } from "@/lib/supabase";
import { deleteBook, getBook, updateBook } from "@/lib/db/openings";
import { libraryErrorResponse } from "@/lib/library/http";
import { patchBookSchema } from "@/lib/validators/schemas";
import { recordUsage } from "@/lib/db/usage";

type Params = { params: Promise<{ bookId: string }> };

/** One of the viewer's books, with its trees. */
export async function GET(_req: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "books_read");

  const { bookId } = await params;
  try {
    const book = await getBook(user.id, bookId);
    if (!book) return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });
    return Response.json(book);
  } catch (error) {
    return libraryErrorResponse(error);
  }
}

/** Changes the name, side or trees; refused with 409 if the book changed since `expectedUpdatedAt`. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "books_write");

  const parsed = patchBookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid change.", code: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { bookId } = await params;
  const { expectedUpdatedAt, ...changes } = parsed.data;
  try {
    return Response.json(await updateBook(user.id, bookId, changes, expectedUpdatedAt));
  } catch (error) {
    return libraryErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await recordUsage(user.id, "books_write");

  const { bookId } = await params;
  try {
    await deleteBook(user.id, bookId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}
