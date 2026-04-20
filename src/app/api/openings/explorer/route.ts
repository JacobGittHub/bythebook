import { fetchExplorerMoves, LichessRateLimitError } from "@/lib/chess/lichessExplorer";
import { getCachedPosition, setCachedPosition } from "@/lib/db/positionCache";
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
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fen = await resolveFenFromRequest(request);
    const cached = await getCachedPosition(fen);

    if (cached) {
      return Response.json({ fen, ...cached, cached: true });
    }

    const explorerData = await fetchExplorerMoves(fen);
    await setCachedPosition(fen, explorerData);

    return Response.json({ fen, ...explorerData, cached: false });
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
