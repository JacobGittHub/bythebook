import { fetchExplorerMoves } from "@/lib/chess/lichessExplorer";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fen = url.searchParams.get("fen") ?? "startpos";
  const moves = await fetchExplorerMoves(fen);

  return Response.json({ fen, moves });
}
