import { countMoveTreeLines, countMoveTreeNodes } from "@/lib/chess/moveTree";
import { startTree } from "@/lib/library/trees";
import type { LibraryBook } from "@/lib/library/types";

export function MoveTree({ book }: { book: LibraryBook }) {
  const tree = startTree(book.trees);
  const lineCount = countMoveTreeLines(tree);
  const nodeCount = Math.max(countMoveTreeNodes(tree) - 1, 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Move tree</h3>
      <p className="mt-2 text-sm text-slate-600">
        {lineCount} prepared line{lineCount === 1 ? "" : "s"} in {book.name}.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {nodeCount} stored move{nodeCount === 1 ? "" : "s"} across{" "}
        {tree.children.length} root branch
        {tree.children.length === 1 ? "" : "es"}.
      </p>
    </div>
  );
}
