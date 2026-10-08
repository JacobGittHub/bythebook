"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { BookMiniature } from "@/components/books/BookMiniature";
import { Input } from "@/components/shadcn/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { filterBooks, type SideFilter } from "@/lib/library/search";
import type { LibraryEntry } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import { BookTags, SideTag, countOf } from "./BookParts";

type Props = {
  books: readonly LibraryEntry[];
  selectedId: string | null;
  onSelect: (bookId: string) => void;
  className?: string;
};

/**
 * The Library's first level (plans/deployment.md D21): every book with its icicle in
 * miniature, searchable by name and filtered by side. It reads only the summaries (D26).
 */
export function BookList({ books, selectedId, onSelect, className }: Props) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<SideFilter>("all");
  const shown = filterBooks(books, query, side);

  return (
    <div className={cn("flex min-w-0 flex-col rounded-md border bg-card", className)}>
      <div className="flex items-center gap-2 border-b p-2">
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
      <ul aria-label="Books" className="max-h-[32rem] overflow-y-auto md:max-h-[calc(100dvh-16rem)]">
        {shown.map((book) => {
          const selected = book.id === selectedId;
          return (
            <li key={book.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(book.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-muted",
                  selected && "bg-muted shadow-[inset_2px_0_0_var(--text-primary)]",
                )}
              >
                <BookMiniature miniature={book.summary.miniature} width={52} height={34} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">{book.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SideTag side={book.color} />
                    <span>·</span>
                    <span className="tabular-nums">{countOf(book.summary.positions, "position")}</span>
                  </span>
                  <BookTags origin={book.origin} summary={book.summary} />
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No book matches.</li>
        )}
      </ul>
    </div>
  );
}
