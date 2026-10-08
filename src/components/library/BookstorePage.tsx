"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Search } from "lucide-react";
import { BookMiniature } from "@/components/books/BookMiniature";
import { Badge } from "@/components/shadcn/badge";
import { Input } from "@/components/shadcn/input";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Toggle } from "@/components/shadcn/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { ExampleBook } from "@/lib/books/examples";
import { MAX_BOOK_POSITIONS } from "@/lib/books/measures";
import { storeBookHref } from "@/lib/library/links";
import { fitBookName } from "@/lib/library/names";
import { filterBooks, type SideFilter } from "@/lib/library/search";
import { PublisherLabel, SideTag, countOf, storeVerified } from "./BookParts";
import { useStoreBooks } from "./useStoreBooks";

const formatCount = (n: number) => n.toLocaleString("en-US");

/** A store book's card (plans/bookstore.md D8): its shape first, then what to expect from it. */
function StoreCard({ book }: { book: ExampleBook }) {
  const verified = storeVerified(book.origin);
  return (
    <li>
      <Link
        href={storeBookHref(book.id)}
        className="flex h-full flex-col gap-2 rounded-md border bg-card p-3 transition-colors hover:border-foreground/40 hover:bg-muted/40"
      >
        <BookMiniature miniature={book.summary.miniature} width={320} height={56} className="h-14 w-full" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{fitBookName(book.name)}</h2>
          {book.origin.kind === "store" && <PublisherLabel name={book.origin.publisher} verified={verified} />}
          <p className="line-clamp-1 text-xs text-muted-foreground">{book.description}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <SideTag side={book.color} />
          <span className="tabular-nums">
            {formatCount(book.summary.positions)} / {formatCount(MAX_BOOK_POSITIONS)}
          </span>
          <span className="tabular-nums">{countOf(book.summary.lines, "line")}</span>
          {book.summary.unconnected && (
            <Badge variant="outline" className="border-[var(--view-clash)]">
              Unconnected lines
            </Badge>
          )}
          <span className="flex-1" />
          <span>No ratings yet</span>
        </div>
        {book.attribution && (
          <p className="truncate text-[11px] text-muted-foreground">
            {book.attribution.title} · {book.attribution.license}
          </p>
        )}
      </Link>
    </li>
  );
}

/**
 * The Bookstore's first level (plans/bookstore.md D8, D14): every store book as a card, with
 * search, side and verified only. Its books are the example books until the store has its own
 * tables, so there are no ratings or saves to show or sort by yet.
 */
export function BookstorePage() {
  const { books, failed } = useStoreBooks();
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<SideFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const shown = filterBooks(books ?? [], query, side).filter((book) => !verifiedOnly || storeVerified(book.origin));

  return (
    <main className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Bookstore</h1>
        <p className="text-sm text-muted-foreground">
          Ready-made opening books. Saving one copies it into your library, where you can edit it as your own.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the Bookstore"
            aria-label="Search the Bookstore"
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
        <Toggle variant="outline" size="sm" pressed={verifiedOnly} onPressedChange={setVerifiedOnly} className="text-xs">
          <BadgeCheck /> Verified only
        </Toggle>
      </div>

      {failed && <p className="text-sm text-muted-foreground">The Bookstore&apos;s books didn&apos;t load. Reload the page to try again.</p>}

      <ul aria-label="Store books" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books === null && !failed
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-44" />
              </li>
            ))
          : shown.map((book) => <StoreCard key={book.id} book={book} />)}
      </ul>
      {books && shown.length === 0 && <p className="text-sm text-muted-foreground">No book matches.</p>}
    </main>
  );
}
