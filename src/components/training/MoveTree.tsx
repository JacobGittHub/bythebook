import type { OpeningBook } from "@/types/chess";
import { countMoveTreeLines, countMoveTreeNodes } from "@/lib/chess/moveTree";

export function MoveTree({ book }: { book: OpeningBook }) {
  const lineCount = countMoveTreeLines(book.moveNode);
  const nodeCount = Math.max(countMoveTreeNodes(book.moveNode) - 1, 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Move tree</h3>
      <p className="mt-2 text-sm text-slate-600">
        {lineCount} prepared line{lineCount === 1 ? "" : "s"} in {book.name}.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {nodeCount} stored move{nodeCount === 1 ? "" : "s"} across{" "}
        {book.moveNode.children.length} root branch
        {book.moveNode.children.length === 1 ? "" : "es"}.
      </p>
    </div>
  );
}
