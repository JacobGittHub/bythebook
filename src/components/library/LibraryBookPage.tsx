"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ink } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread } from "@/components/book/Spread";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibrary, useLibraryBook, useLibraryBooks } from "@/context/Library";
import { pathTo } from "@/lib/books/viewTree";
import { explorerHref, libraryBookHref, libraryHref, storeBookHref } from "@/lib/library/links";
import { BookMenu } from "./BookMenu";
import { BookRows } from "./BookList";
import { BookMeasures, BookTags, OriginLine, SideTag, countOf, originFolio, originShort, positionsOfLimit, storeVerified } from "./BookParts";
import { BookReader } from "./BookReader";
import { RemoveMoveButton } from "./RemoveMoveButton";

/**
 * A book's own page, the Library's second level (plans/book-ui.md D8, plans/deployment.md
 * D21), which the camera zooms in on. The part of the left page in view lists the books, against
 * the spine under the way back to them all, to switch books without going back; another book
 * re-inks the right page. The right page's first screen is the book in a bigger view with all
 * five views and a board; below it are its measures and where it came from. Success rates,
 * difficulty and leaderboards join them there with the trainer and game history.
 */
export function LibraryBookPage({ bookId }: { bookId: string }) {
  const router = useRouter();
  const { form, turn } = useBookFrame();
  const { label } = useLibrary();
  const { books } = useLibraryBooks();
  const index = books?.findIndex((candidate) => candidate.id === bookId) ?? -1;
  const entry = books?.[index] ?? null;
  const { book, status, save } = useLibraryBook(bookId);
  // A move from another book's page doesn't turn (D13), so the page re-inks.
  const inked = turn.id > 0 && turn.way === null;

  const left = (
    <>
      {/* Back to the Library with this book picked, as it was when its page was opened. */}
      <Link href={libraryHref(bookId)} className="book-back self-end">
        Back to all books
      </Link>
      {books ? (
        <div className="-mx-2.5 min-h-0 overflow-y-auto">
          <BookRows books={books} selectedId={bookId} className="mx-0" />
        </div>
      ) : (
        <Skeleton className="h-40" />
      )}
    </>
  );

  let right;
  let below;
  if (books !== null && !entry && status !== "loading") {
    right = (
      <p className="py-6 text-sm text-muted-foreground">
        {status === "failed" ? "The book couldn't be opened." : `This book isn't in your library (${label.toLowerCase()}).`}
      </p>
    );
  } else {
    const storeHref = entry && storeVerified(entry.origin) && entry.origin.kind === "store" ? storeBookHref(entry.origin.sourceId) : null;
    right = (
      <Ink key={bookId} inked={inked} className="flex min-h-0 flex-1 flex-col gap-3">
        {entry ? (
          <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-72">
              <h1 className="flex flex-wrap items-center gap-x-2.5 font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance text-foreground">
                <span className="min-w-0 break-words">{entry.name}</span>
                <SideTag side={entry.color} className="shrink-0 font-sans text-sm font-normal" />
              </h1>
              <div className="mt-1.5">
                <BookTags origin={entry.origin} summary={entry.summary} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button asChild size="sm" variant="outline">
                <Link href={explorerHref({ bookId: entry.id })}>Open in Explorer</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/dashboard/train/${entry.id}`}>Train this book</Link>
              </Button>
              <BookMenu
                book={entry}
                onDeleted={() => router.push(libraryHref())}
                onDuplicated={(copy) => router.push(libraryBookHref(copy.id))}
              />
            </div>
          </header>
        ) : (
          <Skeleton className="h-12 w-80" />
        )}
        {book ? (
          <BookReader
            book={book}
            size="large"
            fill
            positionActions={(node) => (
              <div className="flex flex-col gap-1">
                <Button asChild size="sm" variant="outline">
                  <Link href={explorerHref({ bookId: book.id, line: pathTo(node) })}>Open position in Explorer</Link>
                </Button>
                <RemoveMoveButton book={book} node={node} save={save} />
              </div>
            )}
          />
        ) : (
          <Skeleton className="min-h-64 w-full flex-1" />
        )}
      </Ink>
    );
    below = entry && (
      <Ink key={bookId} inked={inked}>
        <section aria-labelledby="book-about" className="flex flex-col gap-3 border-t border-rule pt-3">
          <h2 id="book-about" className="book-sc">
            About this book
          </h2>
          <BookMeasures summary={entry.summary} />
          <div className="text-xs text-muted-foreground">
            <OriginLine origin={entry.origin} className="inline" />
            {storeHref && (
              <>
                {" "}
                <Link href={storeHref} className="font-bold text-foreground underline">
                  Open in the Bookstore
                </Link>
              </>
            )}
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
            <span className="book-sc">Library{books ? ` · ${countOf(books.length, "book")}` : ""}</span>
          </>
        ),
        body: left,
        folio: entry && books && (
          <>
            <span className="grow" />
            <span>
              Book {index + 1} of {books.length}
            </span>
          </>
        ),
      }}
      right={{
        head: entry && (
          <>
            <span className="book-sc">
              {entry.color === "white" ? "White" : "Black"} · {originShort(entry.origin)}
            </span>
            {/* On one page the head also holds the way back, and the title names the book. */}
            {form === "spread" && (
              <>
                <span className="grow" />
                <span className="truncate">{entry.name}</span>
              </>
            )}
          </>
        ),
        body: right,
        below,
        folio: entry && (
          <>
            <span>{originFolio(entry.origin)}</span>
            <span className="grow" />
            <span>{positionsOfLimit(entry.summary)}</span>
          </>
        ),
      }}
    />
  );
}
