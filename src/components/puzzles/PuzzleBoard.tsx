import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";

export function PuzzleBoard() {
  return (
    <div className="space-y-4">
      <ChessBoard fen="startpos" />
      <div className="flex gap-3">
        <Button>Solve puzzle</Button>
        <Button variant="secondary">Next puzzle</Button>
      </div>
    </div>
  );
}
