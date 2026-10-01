import { getExplorerDataForUser } from "@/lib/chess/explorerService";
import { LichessRateLimitError } from "@/lib/chess/lichessExplorer";
import { getAuthenticatedUser } from "@/lib/supabase";
import {
  explorerBodySchema,
  explorerQuerySchema,
} from "@/lib/validators/schemas";

async function resolveFenFromRequest(request: Request) {
  if (request.method === "POST") {
    const body = await request.json();
    return explorerBodySchema.parse(body).fen;
  }

  const url = new URL(request.url);
  return explorerQuerySchema.parse({
    fen: url.searchParams.get("fen") ?? undefined,
  }).fen;
}

async function handleExplorerRequest(request: Request) {
  // Guests are served too, from the cache only.
  const user = await getAuthenticatedUser();

  try {
    const fen = await resolveFenFromRequest(request);
    const result = await getExplorerDataForUser(fen, user?.id ?? null);

    if (!result) {
      return Response.json(
        { error: "This position is not cached. Live lookups need an account." },
        { status: 404 },
      );
    }

    return Response.json({ fen, ...result.data, cached: result.cached });
  } catch (error) {
    if (error instanceof LichessRateLimitError) {
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        },
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return Response.json({ error: "Invalid explorer request." }, { status: 400 });
    }

    return Response.json(
      { error: "Failed to load opening explorer data." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleExplorerRequest(request);
}

export async function POST(request: Request) {
  return handleExplorerRequest(request);
}
