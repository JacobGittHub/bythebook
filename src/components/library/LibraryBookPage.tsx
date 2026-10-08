"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibrary, useLibraryBook, useLibraryBooks } from "@/context/Library";
import { pathTo } from "@/lib/books/viewTree";
import { explorerHref, libraryBookHref, storeBookHref } from "@/lib/library/links";
import { BookMenu } from "./BookMenu";
import { BookMeasures, BookTags, SideTag, storeVerified } from "./BookParts";
import { BookReader } from "./BookReader";
import { OriginPanel } from "./OriginPanel";
import { RemoveMoveButton } from "./RemoveMoveButton";

/**
 * A book's own page, the Library's second level (plans/deployment.md D21): the book in a
 * bigger view with all five views, its measures, and where it came from. Success rates,
 * difficulty and leaderboards join it with the trainer and game history.
 */
export function LibraryBookPage({ bookId }: { bookId: string }) {
  const router = useRouter();
  const { label } = useLibrary();
  const { books } = useLibraryBooks();
  const entry = books?.find((candidate) => candidate.id === bookId) ?? null;
  const { book, status, save } = useLibraryBook(bookId);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href="/dashboard/library">
        <ChevronLeft /> Library
      </Link>
    </Button>
  );

  if (books !== null && !entry && status !== "loading") {
    return (
      <main className="flex flex-col gap-3">
        {back}
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {status === "failed" ? "The book couldn't be opened." : `This book isn't in your library (${label.toLowerCase()}).`}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-3">
      {back}
      {entry ? (
        <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="flex items-center gap-2 text-2xl font-semibold leading-tight text-foreground">
              <span className="truncate">{entry.name}</span>
              <SideTag side={entry.color} className="shrink-0 text-sm font-normal" />
            </h1>
            <BookTags origin={entry.origin} summary={entry.summary} />
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
              onDeleted={() => router.push("/dashboard/library")}
              onDuplicated={(copy) => router.push(libraryBookHref(copy.id))}
            />
          </div>
        </header>
      ) : (
        <Skeleton className="h-12 w-80" />
      )}
      {entry && <BookMeasures summary={entry.summary} className="rounded-md border bg-card px-3 py-2" />}
      {book ? (
        <div className="rounded-md border bg-card p-3">
          <BookReader
            book={book}
            size="large"
            positionActions={(node) => (
              <div className="flex flex-col gap-1">
                <Button asChild size="sm" variant="outline">
                  <Link href={explorerHref({ bookId: book.id, line: pathTo(node) })}>Open position in Explorer</Link>
                </Button>
                <RemoveMoveButton book={book} node={node} save={save} />
              </div>
            )}
          />
        </div>
      ) : (
        <Skeleton className="h-[34rem] w-full" />
      )}
      {entry && (
        <OriginPanel
          origin={entry.origin}
          storeHref={storeVerified(entry.origin) && entry.origin.kind === "store" ? storeBookHref(entry.origin.sourceId) : null}
        />
      )}
    </main>
  );
}
