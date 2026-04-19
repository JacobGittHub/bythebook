import { listOpeningBooks } from "@/lib/db/openings";

export async function GET() {
  return Response.json({ books: await listOpeningBooks() });
}

export async function POST() {
  return Response.json(
    { message: "Create opening book placeholder" },
    { status: 201 },
  );
}
