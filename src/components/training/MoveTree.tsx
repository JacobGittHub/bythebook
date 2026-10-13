import { Panel } from "@/components/ui/Panel";
import { countMoveTreeLines, countMoveTreeNodes } from "@/lib/chess/moveTree";
import { startTree } from "@/lib/library/trees";
import type { LibraryBook } from "@/lib/library/types";

export function MoveTree({ book }: { book: LibraryBook }) {
  const tree = startTree(book.trees);
  const lineCount = countMoveTreeLines(tree);
  const nodeCount = Math.max(countMoveTreeNodes(tree) - 1, 0);

  return (
    <Panel className="px-3 py-2">
      <h3 className="font-heading font-semibold">Move tree</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {lineCount} prepared line{lineCount === 1 ? "" : "s"} in {book.name}.
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {nodeCount} stored move{nodeCount === 1 ? "" : "s"} across{" "}
        {tree.children.length} root branch
        {tree.children.length === 1 ? "" : "es"}.
      </p>
    </Panel>
  );
}
