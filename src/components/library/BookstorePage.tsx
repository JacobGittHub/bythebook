"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Search } from "lucide-react";
import { Spread } from "@/components/book/Spread";
import { BookMiniature } from "@/components/books/BookMiniature";
import { Badge } from "@/components/shadcn/badge";
import { Input } from "@/components/shadcn/input";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Toggle } from "@/components/shadcn/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { ExampleBook } from "@/lib/books/examples";
import { MAX_BOOK_POSITIONS } from "@/lib/books/measures";
import { bookstoreHref, storeBookHref } from "@/lib/library/links";
import { fitBookName } from "@/lib/library/names";
import { filterBooks, type ShelfFilters, type SideFilter } from "@/lib/library/search";
import { PublisherLabel, SideTag, countOf, storeVerified } from "./BookParts";
import { useStoreBooks } from "./useStoreBooks";

const formatCount = (n: number) => n.toLocaleString("en-US");

/** The store books the shelf's search and filters leave, in the store's order. */
export function shelfBooks(books: readonly ExampleBook[], shelf: ShelfFilters): ExampleBook[] {
  return filterBooks(books, shelf.query, shelf.side).filter((book) => !shelf.verifiedOnly || storeVerified(book.origin));
}

/** The shelf the filters make, in a few words, such as "for Black, verified". */
function shelfName(shelf: ShelfFilters): string {
  const parts = [shelf.side === "all" ? "all books" : `for ${shelf.side === "white" ? "White" : "Black"}`];
  if (shelf.verifiedOnly) parts.push("verified");
  if (shelf.query.trim()) parts.push(`“${shelf.query.trim()}”`);
  return parts.join(", ");
}

/** A store book on the shelf (plans/bookstore.md D8): its shape first, then what to expect from it. */
function StoreCard({ book, shelf }: { book: ExampleBook; shelf: ShelfFilters }) {
  return (
    <li className="min-w-0">
      <Link
        href={storeBookHref(book.id, shelf)}
        className="flex h-full flex-col gap-1 rounded-sm border-t border-rule px-2 pt-2.5 pb-[11px] hover:bg-accent"
      >
        <BookMiniature miniature={book.summary.miniature} width={320} height={26} className="h-[26px] w-full" />
        <h2 className="truncate font-heading text-[15px] leading-[1.3] font-semibold text-foreground">{fitBookName(book.name)}</h2>
        {book.origin.kind === "store" && <PublisherLabel name={book.origin.publisher} verified={storeVerified(book.origin)} />}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] whitespace-nowrap text-muted-foreground">
          <SideTag side={book.color} className="text-[11.5px]" />
          <span aria-hidden>·</span>
          <span className="font-mono tabular-nums">
            {formatCount(book.summary.positions)} / {formatCount(MAX_BOOK_POSITIONS)}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{countOf(book.summary.lines, "line")}</span>
          {book.summary.unconnected && (
            <Badge variant="outline" className="border-[var(--view-clash)] text-foreground">
              Unconnected lines
            </Badge>
          )}
          <span className="ml-auto">No ratings yet</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * The Bookstore's first level as a spread (plans/book-ui.md D9, plans/bookstore.md D8, D14):
 * its search and filters on the left page, and the shelf they leave on the right, a card per
 * book. The filters are kept in the address (`?q=&side=&verified=`), which the page reads as
 * `initialShelf`, and a card's address carries them, so the book's page lists the same shelf.
 * Its books are the example books until the store has its own tables, so there are no ratings
 * or saves to show or sort by yet, and no shelves beyond what the filters make.
 */
export function BookstorePage({ initialShelf }: { initialShelf: ShelfFilters }) {
  const { books, failed } = useStoreBooks();
  const [shelf, setShelf] = useState(initialShelf);
  const shown = books ? shelfBooks(books, shelf) : [];

  const change = (next: Partial<ShelfFilters>) => {
    const changed = { ...shelf, ...next };
    window.history.replaceState(null, "", bookstoreHref(changed));
    setShelf(changed);
  };

  const left = (
    <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">Bookstore</h1>
        <p className="text-sm text-muted-foreground">
          Ready-made opening books. Saving one copies it into your library, where you can edit it as your own.
        </p>
      </header>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={shelf.query}
          onChange={(event) => change({ query: event.target.value })}
          placeholder="Search the Bookstore"
          aria-label="Search the Bookstore"
          className="h-8 pl-7 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={shelf.side}
          onValueChange={(next) => next && change({ side: next as SideFilter })}
          aria-label="Side"
        >
          <ToggleGroupItem value="all" className="px-2.5 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="white" className="px-2.5 text-xs">
            White
          </ToggleGroupItem>
          <ToggleGroupItem value="black" className="px-2.5 text-xs">
            Black
          </ToggleGroupItem>
        </ToggleGroup>
        <Toggle
          variant="outline"
          size="sm"
          pressed={shelf.verifiedOnly}
          onPressedChange={(pressed) => change({ verifiedOnly: pressed })}
          className="text-xs"
        >
          <BadgeCheck /> Verified only
        </Toggle>
      </div>
      <p className="text-xs text-muted-foreground">
        Ratings, saves and books from other players come with the store&apos;s back end.
      </p>
    </div>
  );

  const right = (
    <div className="@container -mr-2.5 min-h-0 flex-1 overflow-y-auto pr-2.5">
      {failed && <p className="text-sm text-muted-foreground">The Bookstore&apos;s books didn&apos;t load. Reload the page to try again.</p>}
      <ul aria-label="Store books" className="grid grid-cols-1 gap-x-[22px] @sm:grid-cols-2">
        {books === null && !failed
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="border-t border-rule py-2.5">
                <Skeleton className="h-24" />
              </li>
            ))
          : shown.map((book) => <StoreCard key={book.id} book={book} shelf={shelf} />)}
      </ul>
      {books && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No book matches.</p>}
    </div>
  );

  return (
    <Spread
      left={{
        head: (
          <>
            <span>Bookstore</span>
            <span className="grow" />
            {books && <span className="book-sc">{countOf(books.length, "book")}</span>}
          </>
        ),
        body: left,
        folio: books && (
          <>
            <span className="truncate">Shelf: {shelfName(shelf)}</span>
            <span className="grow" />
            <span className="shrink-0">{countOf(books.length, "book")} in all</span>
          </>
        ),
      }}
      right={{
        head: (
          <>
            <span className="book-sc truncate">{shelfName(shelf)}</span>
            <span className="grow" />
            <span>The shelf</span>
          </>
        ),
        body: right,
        folio: books && (
          <>
            <span>{countOf(shown.length, "book")}</span>
            <span className="grow" />
            <span>positions against the {formatCount(MAX_BOOK_POSITIONS)} limit</span>
          </>
        ),
      }}
    />
  );
}
