"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/shadcn/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { libraryBookHref } from "@/lib/library/links";
import { filterBooks, type SideFilter } from "@/lib/library/search";
import type { LibraryEntry } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import { SideSquare } from "./BookParts";

type RowsProps = {
  books: readonly Pick<LibraryEntry, "id" | "name" | "color" | "summary">[];
  selectedId: string | null;
  /** Where a row's link goes: the book's own page in the Library unless given. */
  hrefOf?: (bookId: string) => string;
  /**
   * Called when a row is pressed, before its link goes to the book's page; it may stop the
   * link, as the Library's first level does to pick the book instead.
   */
  onPick?: (bookId: string, event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

/**
 * The books as the lines of a contents (plans/book-ui.md D8, D9): the side, the name, a dotted
 * leader and the book's figure, its positions. Each row links to the book's own page, in the
 * Library or the Bookstore. It reads only the summaries (plans/deployment.md D26).
 */
export function BookRows({ books, selectedId, hrefOf = libraryBookHref, onPick, className }: RowsProps) {
  return (
    <ul aria-label="Books" className={cn("-mx-2.5 flex flex-col gap-px", className)}>
      {books.map((book) => {
        const selected = book.id === selectedId;
        return (
          <li key={book.id}>
            <Link
              href={hrefOf(book.id)}
              aria-current={selected ? "true" : undefined}
              onClick={(event) => onPick?.(book.id, event)}
              className={cn("flex items-baseline gap-2 rounded-md px-2.5 py-[7px] hover:bg-accent", selected && "bg-accent")}
            >
              <SideSquare side={book.color} className="-translate-y-px" />
              <span className={cn("min-w-0 truncate font-heading text-sm leading-[1.2]", selected ? "font-semibold" : "font-medium")}>
                {book.name}
              </span>
              <span aria-hidden className="min-w-3 flex-1 -translate-y-[3px] border-b-[1.5px] border-dotted border-muted-foreground opacity-55" />
              {/* The book's figure. Its positions for now; something more personal, such as how
                  much of it is explored, may take this place (D8). */}
              <span className="font-mono text-xs leading-none whitespace-nowrap text-muted-foreground tabular-nums">
                {book.summary.positions.toLocaleString("en-US")}
                <span className="sr-only">{book.summary.positions === 1 ? " position" : " positions"}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Library's book list (plans/deployment.md D21): the books as contents rows, searchable
 * by name and filtered by side.
 */
export function BookList({ books, selectedId, onPick, className }: RowsProps) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<SideFilter>("all");
  const shown = filterBooks(books, query, side);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-2.5", className)}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search books"
            aria-label="Search books"
            className="h-8 pl-7 text-sm"
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={side}
          onValueChange={(next) => next && setSide(next as SideFilter)}
          aria-label="Side"
        >
          <ToggleGroupItem value="all" className="px-2 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="white" className="px-2 text-xs">
            White
          </ToggleGroupItem>
          <ToggleGroupItem value="black" className="px-2 text-xs">
            Black
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="-mx-2.5 min-h-24 overflow-y-auto">
        <BookRows books={shown} selectedId={selectedId} onPick={onPick} className="mx-0" />
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No book matches.</p>}
      </div>
    </div>
  );
}
