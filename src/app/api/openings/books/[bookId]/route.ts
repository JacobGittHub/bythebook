import { getAuthenticatedUser } from "@/lib/supabase";
import { getOpeningBook, updateOpeningBookTree } from "@/lib/db/openings";
import { parseMoveNode } from "@/lib/chess/moveTree";
import { updateBookTreeSchema } from "@/lib/validators/schemas";
import type { Json } from "@/types/database";

type Params = { params: Promise<{ bookId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId } = await params;
  const book = await getOpeningBook(bookId);
  if (!book) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(book);
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId } = await params;

  const existing = await getOpeningBook(bookId);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json();
  const parsed = updateBookTreeSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const moveNode = parseMoveNode(parsed.data.moveNode as Json);
  await updateOpeningBookTree(bookId, moveNode);

  return Response.json({ ok: true });
}
