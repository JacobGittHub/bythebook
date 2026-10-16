"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Ink } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread } from "@/components/book/Spread";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { EXAMPLE_METHOD_NOTES, exampleDraft } from "@/lib/books/examples";
import { pathTo } from "@/lib/books/viewTree";
import { bookstoreHref, explorerHref, libraryBookHref, storeBookHref } from "@/lib/library/links";
import { fitBookName } from "@/lib/library/names";
import type { ShelfFilters } from "@/lib/library/search";
import { libraryErrorMessage } from "@/lib/library/types";
import { BookRows } from "./BookList";
import { BookMeasures, JumpTag, PublisherLabel, SideTag, countOf, originFolio, originShort, positionsOfLimit, storeVerified } from "./BookParts";
import { BookReader } from "./BookReader";
import { shelfBooks } from "./BookstorePage";
import { useStoreBooks } from "./useStoreBooks";

const STORE_NOTES = {
  browser: "Saving copies it into this browser's library.",
  account: "Saving copies it into your account's library.",
} as const;

/**
 * A store book's page, the Bookstore's second level (plans/book-ui.md D9, plans/bookstore.md
 * D8, D14), which the camera zooms in on. The part of the left page in view lists the shelf's
 * books as its search and filters left them (`shelf`), against the spine under the way back to
 * the shelf; another book re-inks the right page. The right page's first screen is the book's
 * name, publisher and description, Save to library, which copies it into the browser for a
 * guest and into the account when signed in, and the book in any of the five views with a
 * board; below it are its measures and how it was made.
 */
export function StoreBookPage({ storeId, shelf }: { storeId: string; shelf: ShelfFilters }) {
  const { form, turn } = useBookFrame();
  const { books, failed } = useStoreBooks();
  const { library, store } = useLibrary();
  const { books: own } = useLibraryBooks();
  const [saving, setSaving] = useState(false);
  const book = books?.find((candidate) => candidate.id === storeId) ?? null;
  const shelved = books ? shelfBooks(books, shelf) : null;
  const index = shelved?.findIndex((candidate) => candidate.id === storeId) ?? -1;
  // The library's copy of this book, if it has one (D5: a copy, not a link).
  const copy = own?.find((entry) => entry.origin.kind === "store" && entry.origin.sourceId === storeId) ?? null;
  // A move from another book's page doesn't turn (D13), so the page re-inks.
  const inked = turn.id > 0 && turn.way === null;

  const save = async () => {
    if (!book) return;
    setSaving(true);
    try {
      await library.create(exampleDraft(book));
      toast.success(`Saved ${fitBookName(book.name)} to your library.`);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const left = (
    <>
      {/* Back to the shelf, searched and filtered as it was. */}
      <Link href={bookstoreHref(shelf)} className="book-back self-end">
        Back to the shelf
      </Link>
      {shelved ? (
        <div className="-mx-2.5 min-h-0 overflow-y-auto">
          <BookRows books={shelved} selectedId={storeId} hrefOf={(id) => storeBookHref(id, shelf)} className="mx-0" />
          {shelved.length === 0 && <p className="px-2.5 py-6 text-sm text-muted-foreground">No book matches.</p>}
        </div>
      ) : (
        !failed && <Skeleton className="h-40" />
      )}
    </>
  );

  let right;
  let below;
  if (books === null && !failed) {
    right = (
      <>
        <Skeleton className="h-12 w-80" />
        <Skeleton className="min-h-64 w-full flex-1" />
      </>
    );
  } else if (!book) {
    right = (
      <p className="py-6 text-sm text-muted-foreground">
        {failed ? "The Bookstore's books didn't load." : "The Bookstore has no such book."}
      </p>
    );
  } else {
    right = (
      <Ink key={storeId} inked={inked} className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="flex flex-wrap items-center gap-x-2.5 font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance text-foreground">
              <span className="min-w-0 break-words">{fitBookName(book.name)}</span>
              <SideTag side={book.color} className="shrink-0 font-sans text-sm font-normal" />
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {book.origin.kind === "store" && <PublisherLabel name={book.origin.publisher} verified={storeVerified(book.origin)} />}
              <span>· No ratings yet</span>
            </div>
            <p className="mt-2 max-w-prose text-sm text-foreground">{book.description}</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {copy ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-sm text-foreground">
                  <Check className="size-4" /> In your library
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={libraryBookHref(copy.id)}>
                    Open in Library <JumpTag />
                  </Link>
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => void save()} disabled={saving || own === null}>
                {saving ? "Saving…" : "Save to library"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{copy ? "Saving again makes a second copy." : STORE_NOTES[store]}</span>
            {copy && (
              <Button size="sm" variant="ghost" onClick={() => void save()} disabled={saving} className="h-7 text-xs">
                {saving ? "Saving…" : "Save another copy"}
              </Button>
            )}
          </div>
        </header>
        <BookReader
          book={book}
          size="large"
          fill
          positionActions={(node) => (
            <Button asChild size="sm" variant="outline">
              <Link href={explorerHref({ line: pathTo(node) })}>Open position in Explorer</Link>
            </Button>
          )}
        />
      </Ink>
    );
    below = (
      <Ink key={storeId} inked={inked}>
        <section aria-labelledby="store-book-about" className="flex flex-col gap-3 border-t border-rule pt-3">
          <h2 id="store-book-about" className="book-sc">
            About this book
          </h2>
          <BookMeasures summary={book.summary} />
          <div className="flex max-w-prose flex-col gap-1.5 text-xs text-muted-foreground">
            <p>{EXAMPLE_METHOD_NOTES[book.method]}</p>
            {book.attribution ? (
              <p>
                Source:{" "}
                <a href={book.attribution.url} target="_blank" rel="noreferrer" className="underline">
                  {book.attribution.title}
                </a>
                , by {book.attribution.author} (
                <a href={book.attribution.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                  {book.attribution.license}
                </a>
                ), retrieved {book.attribution.retrieved}. {book.attribution.changes} A saved copy keeps this credit.
              </p>
            ) : (
              <p>How it was built: {book.rules}.</p>
            )}
            <p>Ratings come later, from signed-in readers.</p>
          </div>
        </section>
      </Ink>
    );
  }

  return (
    <Spread
      left={{
        head: (
          <>
            <span className="grow" />
            <span className="book-sc">Bookstore{shelved ? ` · ${countOf(shelved.length, "book")}` : ""}</span>
          </>
        ),
        body: left,
        folio: shelved && index >= 0 && (
          <>
            <span className="grow" />
            <span>
              Book {index + 1} of {shelved.length}
            </span>
          </>
        ),
      }}
      right={{
        head: book && (
          <>
            <span className="book-sc">
              {book.color === "white" ? "White" : "Black"} · {originShort(book.origin)}
            </span>
            {/* On one page the head also holds the way back, and the title names the book. */}
            {form === "spread" && (
              <>
                <span className="grow" />
                <span className="truncate">{fitBookName(book.name)}</span>
              </>
            )}
          </>
        ),
        body: right,
        below,
        folio: book && (
          <>
            <span>{originFolio(book.origin)}</span>
            <span className="grow" />
            <span>{positionsOfLimit(book.summary)}</span>
          </>
        ),
      }}
    />
  );
}
