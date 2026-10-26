"use client";

import type { ReactNode } from "react";
import { useBookFrame } from "@/components/book/BookFrame";
import { BookView } from "@/components/books/BookView";
import { BookViewIcon } from "@/components/books/BookViewRail";
import { useViewZoom } from "@/components/books/useViewZoom";
import { ZoomControls } from "@/components/books/ZoomControls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import type { BookSide } from "@/lib/books/measures";
import { BOOK_VIEWS, isBookViewId, type BookViewId } from "@/lib/books/views";
import type { Walk } from "@/lib/books/views/camera";
import type { ViewNode, ViewTree } from "@/lib/books/viewTree";
import { Key } from "./GameHistoryPage";

type Props = {
  tree: ViewTree;
  side: BookSide;
  /** The book's name, for the drawing's accessible name. */
  name: string;
  selected: ViewNode;
  /** The spine and ribs view's last position on the spine. */
  spineEndId?: string;
  onSelect: (node: ViewNode) => void;
  onHover: (node: ViewNode | null) => void;
  walk: Walk | null;
  onWalkChange: (walk: Walk) => void;
  view: BookViewId;
  onView: (view: BookViewId) => void;
  /** The user's score at each position, which colors the drawing. */
  success?: ReadonlyMap<string, number | null>;
  /** The user's games at each position, which thicken the drawing. */
  thickness?: ReadonlyMap<string, number>;
  /** What the drawing's colors and lines mean, after the key hints. */
  legend?: ReactNode;
};

/**
 * The book drawn in a view on a book's own page, the Library's or the Bookstore's
 * (plans/game-history.md D40, plans/bookstore.md D24): the view picker and zoom above it, and
 * the arrow keys' hints below, since the keys walk it from anywhere on the page.
 */
export function BookDrawing({ tree, side, name, selected, spineEndId, onSelect, onHover, walk, onWalkChange, view, onView, success, thickness, legend }: Props) {
  const zoom = useViewZoom();
  const viewInfo = BOOK_VIEWS.find((option) => option.id === view)!;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={view}
          onValueChange={(next) => {
            if (!isBookViewId(next)) return;
            onView(next);
            onHover(null);
          }}
        >
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
        <span className="grow" />
        <ZoomControls zoom={zoom} />
      </div>
      <div data-slot="panel" className="relative flex h-[28rem] min-h-64 rounded-md border bg-muted p-1 [--bv-label-halo:var(--muted)] md:h-auto md:min-h-32 md:flex-1">
        <BookView
          tree={tree}
          view={view}
          selectedId={selected.id}
          spineEndId={spineEndId}
          side={side}
          onSelect={onSelect}
          onHover={onHover}
          label={`${viewInfo.label} of ${name}`}
          zoom={zoom}
          success={success}
          thickness={thickness}
          walk={walk}
          onWalkChange={onWalkChange}
          keysAnywhere
          className="flex-1"
        />
      </div>
      <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        <span>
          <Key>↑</Key> <Key>↓</Key> choose a move
        </span>
        <span>
          <Key>→</Key> play it
        </span>
        <span>
          <Key>←</Key> back
        </span>
        <span className="grow" />
        {legend}
      </p>
    </>
  );
}

/** A book's own page's right running head: the side and whose book it is, and, in the spread, its name. */
export function BookPageHead({ name, side, whose }: { name: string; side: BookSide; whose: string }) {
  const { form } = useBookFrame();
  return (
    <>
      <span className="book-sc">
        {side === "white" ? "White" : "Black"} · {whose}
      </span>
      {/* On one page the title is far up the page, so the head names the book. */}
      {form === "spread" && (
        <>
          <span className="grow" />
          <span className="truncate">{name}</span>
        </>
      )}
    </>
  );
}
