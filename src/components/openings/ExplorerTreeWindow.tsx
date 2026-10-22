"use client";

import { useMemo, useState } from "react";
import { BookView } from "@/components/books/BookView";
import { BookViewRail } from "@/components/books/BookViewRail";
import { PositionTooltip } from "@/components/books/PositionTooltip";
import { useViewZoom } from "@/components/books/useViewZoom";
import { ZoomControls } from "@/components/books/ZoomControls";
import { useStoredString } from "@/hooks/useStoredString";
import { explorerTree, type BookLineTree } from "@/lib/books/explorerTree";
import type { BookSide } from "@/lib/books/measures";
import { buildViewTree, heavyLeaf, pathTo, type ViewNode } from "@/lib/books/viewTree";
import { BOOK_VIEWS, DEFAULT_EXPLORER_VIEW, isBookViewId } from "@/lib/books/views";
import type { Point } from "@/lib/books/views/common";
import type { ExplorerMove, Move } from "@/types/chess";

const NO_STATS = new Map<string, ExplorerMove>();

/** Where the chosen view is kept in the browser. */
const VIEW_KEY = "bythebook.explorer.view";

type Props = {
  history: readonly { san: string; uci: string; fen: string }[];
  /** The master moves at the position before each played move, when loaded. */
  before: readonly (readonly ExplorerMove[] | null)[];
  /** The master moves at the current position. */
  next: readonly ExplorerMove[];
  orientation: "white" | "black";
  /** Go to the position after these moves, by a reset and a replay. */
  onGoToLine: (moves: Move[]) => void;
  /** Play this move from the current position. */
  onPlayMove: (move: Move) => void;
  /** The hovered move from the current position, for the board's arrow. */
  onHoverUci: (uci: string | null) => void;
  /** The chosen book with the line played on it, to draw in place of the explored line (D17). */
  book?: { name: string; side: BookSide; line: BookLineTree } | null;
};

/**
 * The Explorer's side window: the played line, the master moves around it and the moves
 * from here, drawn by whichever book view the viewer picked on the rail (spine and ribs by
 * default). Given a `book`, it draws the book instead, with the current position marked and
 * the moves played past its end dashed (plans/book-ui.md D17). Clicking a position goes to it;
 * hovering one shows its board.
 */
export function ExplorerTreeWindow({ history, before, next, orientation, onGoToLine, onPlayMove, onHoverUci, book = null }: Props) {
  const [stored, setStored] = useStoredString(VIEW_KEY);
  const view = isBookViewId(stored) ? stored : DEFAULT_EXPLORER_VIEW;
  const [hover, setHover] = useState<{ node: ViewNode; pointer: Point } | null>(null);
  const zoom = useViewZoom();

  const bookLine = book?.line ?? null;
  const { tree, currentId, stats } = useMemo(() => {
    if (bookLine) return { tree: buildViewTree(bookLine.source), currentId: bookLine.currentId, stats: NO_STATS };
    const built = explorerTree({ history, before, next });
    return { tree: buildViewTree(built.source), currentId: built.currentId, stats: built.stats };
  }, [bookLine, history, before, next]);

  const select = (node: ViewNode) => {
    if (node.id === currentId) return;
    const move = { san: node.san ?? "", uci: node.uci ?? "" };
    if (node.parent?.id === currentId) onPlayMove(move);
    else onGoToLine(pathTo(node).slice(1).map((n) => ({ san: n.san ?? "", uci: n.uci ?? "" })));
    setHover(null);
    onHoverUci(null);
  };

  const label = BOOK_VIEWS.find((option) => option.id === view)!.label;

  return (
    <div className="flex h-full min-h-0 gap-1.5">
      <BookViewRail view={view} onChange={setStored} />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <BookView
          tree={tree}
          view={view}
          selectedId={currentId}
          spineEndId={heavyLeaf(book ? (tree.byId.get(currentId) ?? tree.root) : tree.root).id}
          side={book?.side ?? null}
          weight={book ? "lines" : "games"}
          onSelect={select}
          onHover={(node, pointer) => {
            setHover(node && pointer ? { node, pointer } : null);
            onHoverUci(node && node.parent?.id === currentId ? node.uci : null);
          }}
          label={`${label} of ${book ? book.name : "the explored line"}`}
          zoom={zoom}
          className="flex-1 rounded-sm bg-muted [--bv-label-halo:var(--muted)]"
        />
        <ZoomControls
          zoom={zoom}
          className="absolute right-3.5 bottom-3.5 rounded-md border bg-card/90"
        />
      </div>
      {hover && (
        <PositionTooltip node={hover.node} pointer={hover.pointer} stats={stats.get(hover.node.id)} orientation={orientation} />
      )}
    </div>
  );
}
