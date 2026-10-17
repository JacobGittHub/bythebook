"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBookFrame } from "@/components/book/BookFrame";
import { BookMeasures, OriginLine, positionsOfLimit } from "@/components/library/BookParts";
import { BookReader } from "@/components/library/BookReader";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { VisualizationLevel } from "@/components/visualizations/VisualizationLevel";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { EXAMPLE_ID_PREFIX, EXAMPLE_METHOD_NOTES, creditLine, type ExampleBook } from "@/lib/books/examples";
import { BOOK_VIEWS, isBookViewId, type BookViewId } from "@/lib/books/views";
import { pathTo } from "@/lib/books/viewTree";
import { explorerHref } from "@/lib/library/links";
import type { LibraryBook } from "@/lib/library/types";
import { BookSelect, FIRST_EXAMPLE_BOOK } from "./BookSelect";
import { useExampleBooks } from "./useExampleBooks";

/** A book view's own page, with `book` open. */
const bookViewHref = (view: BookViewId, book: string) =>
  `/dashboard/visualizations/books/${view}?book=${encodeURIComponent(book)}`;

type Props = {
  view: BookViewId;
  /** The book named in the address, if any. */
  initialBookId: string | null;
};

/**
 * A book view's own page, a page of the Visualizations chapter (plans/book-ui.md D18): one book
 * drawn by one of the five book views, beside a board for the selected or hovered position. Its
 * first screen is the view's name, the book picker and the drawing; below it are the book's
 * measures and where it came from. The other views are in the list on the left page, which keeps
 * the book; on one page, where the list isn't shown, a menu beside the book picker switches.
 */
export function BookViewPage({ view, initialBookId }: Props) {
  const router = useRouter();
  const { form } = useBookFrame();
  const [bookId, setBookId] = useState<string>(initialBookId ?? FIRST_EXAMPLE_BOOK);
  const { entries, books: examples, failed } = useExampleBooks(bookId);
  // The viewer's own books, a guest's included, from the library.
  const { books: ownBooks } = useLibraryBooks();
  const isExample = bookId.startsWith(EXAMPLE_ID_PREFIX);
  const { book: ownBook, status: ownStatus } = useLibraryBook(isExample ? null : bookId);
  const book: LibraryBook | ExampleBook | null = isExample ? (examples.get(bookId) ?? null) : ownBook;
  const example = examples.get(bookId) ?? null;
  const viewInfo = BOOK_VIEWS.find((option) => option.id === view)!;

  // The address follows the book, so a link reopens it.
  const changeBook = (next: string) => {
    setBookId(next);
    window.history.replaceState(null, "", bookViewHref(view, next));
  };

  const pickers = (
    <div className="flex flex-wrap items-center gap-2">
      {form === "single" && (
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          View
          <NativeSelect
            aria-label="View"
            size="sm"
            value={view}
            onChange={(event) => {
              if (isBookViewId(event.target.value)) router.push(bookViewHref(event.target.value, bookId));
            }}
            className="h-7 pl-1.5 pr-7 text-xs"
          >
            {BOOK_VIEWS.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      )}
      <BookSelect value={bookId} onChange={changeBook} examples={entries} ownBooks={ownBooks} />
    </div>
  );

  const missing = isExample
    ? failed
      ? "The example books didn't load."
      : null
    : ownStatus === "missing"
      ? "This book isn't in your library."
      : ownStatus === "failed"
        ? "The book couldn't be opened."
        : null;

  const below = book && (
    <section aria-labelledby="view-book-about" className="flex flex-col gap-3 border-t border-rule pt-3">
      <h2 id="view-book-about" className="book-sc">
        About {book.name}
      </h2>
      {example && <p className="max-w-prose text-sm">{example.description}</p>}
      <BookMeasures summary={book.summary} />
      <div className="flex max-w-prose flex-col gap-1.5 text-xs text-muted-foreground">
        {example ? (
          <>
            <p>{EXAMPLE_METHOD_NOTES[example.method]}</p>
            {example.attribution ? (
              <p>
                Source:{" "}
                <a href={example.attribution.url} target="_blank" rel="noreferrer" className="underline">
                  {creditLine(example.attribution)}
                </a>{" "}
                (
                <a href={example.attribution.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                  licence
                </a>
                ), retrieved {example.attribution.retrieved}. {example.attribution.changes}
              </p>
            ) : (
              <p>How it was built: {example.rules}.</p>
            )}
          </>
        ) : (
          <OriginLine origin={book.origin} />
        )}
      </div>
    </section>
  );

  return (
    <VisualizationLevel
      id={view}
      bookId={bookId}
      inkKey={bookId}
      below={below}
      folio={
        book && (
          <>
            <span className="truncate">{book.name}</span>
            <span className="grow" />
            <span>{positionsOfLimit(book.summary)}</span>
          </>
        )
      }
    >
      <header className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance">{viewInfo.label}</h1>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">{viewInfo.summary}</p>
        </div>
        {pickers}
      </header>
      {book ? (
        <BookReader
          key={bookId}
          book={book}
          view={view}
          size="large"
          fill
          positionActions={(node) => (
            <Button asChild size="sm" variant="outline">
              <Link href={explorerHref({ bookId: isExample ? null : bookId, line: pathTo(node) })}>
                Open position in Explorer
              </Link>
            </Button>
          )}
        />
      ) : missing ? (
        <p className="py-6 text-sm text-muted-foreground">{missing}</p>
      ) : (
        <Skeleton className="min-h-64 w-full flex-1" />
      )}
    </VisualizationLevel>
  );
}
