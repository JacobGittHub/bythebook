type ChessBoardProps = {
  fen: string;
  orientation?: "white" | "black";
};

export function ChessBoard({
  fen,
  orientation = "white",
}: ChessBoardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="aspect-square rounded-2xl bg-[linear-gradient(135deg,_#e2e8f0_25%,_#cbd5e1_25%,_#cbd5e1_50%,_#e2e8f0_50%,_#e2e8f0_75%,_#cbd5e1_75%)] bg-[length:64px_64px]" />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>FEN: {fen}</span>
        <span>Orientation: {orientation}</span>
      </div>
    </div>
  );
}
