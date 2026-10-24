"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BookView } from "@/components/books/BookView";
import { BookViewIcon } from "@/components/books/BookViewRail";
import { SelectedPosition } from "@/components/books/SelectedPosition";
import { useBookSelection } from "@/components/books/useBookSelection";
import { useViewZoom } from "@/components/books/useViewZoom";
import { ZoomControls } from "@/components/books/ZoomControls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { BookSide } from "@/lib/books/measures";
import { BOOK_VIEWS, isBookViewId, type BookViewId } from "@/lib/books/views";
import { buildViewTree, type ViewNode } from "@/lib/books/viewTree";
import { startTree } from "@/lib/library/trees";
import { cn } from "@/lib/utils";
import type { MoveNode } from "@/types/chess";

/**
 * The view a book opens in, in the Library and the Bookstore (plans/deployment.md D21, amended by
 * plans/game-history.md D31): the icicle where a book is previewed small, ply columns on a book's
 * own page.
 */
export const DEFAULT_READER_VIEW: Record<Props["size"], BookViewId> = { compact: "icicle", large: "ply-columns" };

type Props = {
  book: { id: string; name: string; color: BookSide; trees: readonly MoveNode[] };
  /**
   * "compact" picks the view from a menu, for the Library's list page; "large" shows the five
   * views as buttons and gives the drawing more room, for a book's own page, where the arrow keys
   * walk the drawing from anywhere on the page.
   */
  size: "compact" | "large";
  /** A view fixed by the page, as on a book view's own page, in place of the reader's picker. */
  view?: BookViewId;
  /** Buttons for the selected position, such as Remove move. */
  positionActions?: (selected: ViewNode) => ReactNode;
  /** The drawing takes the height the reader is given, as on a page of the book, not a set one. */
  fill?: boolean;
  /** Whether the board for the selected position shows beside the drawing. */
  board?: boolean;
  className?: string;
};

/**
 * A book to read: one of the five book views with zoom, beside a board for the selected or
 * hovered position. On a phone the board comes first, since a phone has height to spare and
 * not width. Until the views draw several trees, it shows the tree from the starting position.
 */
export function BookReader({ book, size, view: fixedView, positionActions, fill = false, board = true, className }: Props) {
  const [pickedView, setView] = useState<BookViewId>(DEFAULT_READER_VIEW[size]);
  const view = fixedView ?? pickedView;
  const zoom = useViewZoom();
  const tree = useMemo(() => buildViewTree(startTree(book.trees)), [book.trees]);
  const { selectedId, spineEndId, selected, hovered, shown, select, setHovered } = useBookSelection(tree, book.id);
  const viewInfo = BOOK_VIEWS.find((option) => option.id === view)!;

  const changeView = (next: string) => {
    if (!isBookViewId(next)) return;
    setView(next);
    setHovered(null);
  };

  const picker =
    size === "compact" ? (
      <Select value={view} onValueChange={changeView}>
        <SelectTrigger size="sm" aria-label="Book view" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOK_VIEWS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <BookViewIcon view={option.id} />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        onValueChange={(next) => next && changeView(next)}
        aria-label="Book view"
        className="flex-wrap"
      >
        {BOOK_VIEWS.map((option) => (
          <ToggleGroupItem key={option.id} value={option.id} aria-label={option.label} className="px-2.5">
            <BookViewIcon view={option.id} />
            <span className="hidden sm:inline">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 md:flex-row", fill && "min-h-0 flex-1", className)}>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2", fill && "min-h-0")}>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedView && picker}
          <span className="flex-1" />
          <ZoomControls zoom={zoom} />
        </div>
        <div
          data-slot="panel"
          className={cn(
            "relative flex min-h-0 rounded-md border bg-muted p-1 [--bv-label-halo:var(--muted)]",
            fill ? "min-h-64 flex-1" : size === "compact" ? "h-80 md:h-[26rem]" : "h-96 md:h-[34rem]",
          )}
        >
          {selectedId && spineEndId && (
            <BookView
              tree={tree}
              view={view}
              selectedId={selectedId}
              spineEndId={spineEndId}
              side={book.color}
              onSelect={select}
              onHover={(node) => setHovered(node)}
              label={`${viewInfo.label} of ${book.name}`}
              zoom={zoom}
              keysAnywhere={size === "large"}
              className="flex-1"
            />
          )}
        </div>
      </div>
      {board && (
        <SelectedPosition
          node={shown}
          preview={hovered !== null}
          side={book.color}
          boardClassName={size === "compact" ? "max-w-60" : "max-w-72"}
          className={cn(
            "order-first shrink-0 md:order-none",
            size === "compact" ? "md:w-60" : "md:w-72",
            // Beside a drawing that fills the page, the position scrolls on its own (AGENTS.md § "UI").
            fill && "md:min-h-0 md:overflow-y-auto",
          )}
        >
          {selected && positionActions?.(selected)}
        </SelectedPosition>
      )}
    </div>
  );
}
