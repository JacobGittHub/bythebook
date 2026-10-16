"use client";

import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibraryBook } from "@/context/Library";
import { explorerHref, libraryBookHref } from "@/lib/library/links";
import type { LibraryEntry } from "@/lib/library/types";
import { BookMenu } from "./BookMenu";
import { BookMeasures, BookTags, OriginLine, SideTag } from "./BookParts";
import { BookReader } from "./BookReader";

type Props = {
  entry: LibraryEntry;
  onDeleted: () => void;
  onDuplicated: (copy: LibraryEntry) => void;
};

/**
 * The picked book, on the Library's right page (plans/book-ui.md D8): its name, tags and
 * measures, the ways out to its own page, the Explorer and the trainer, and the book itself in
 * a view that takes the rest of the page. The board for a position is on the book's own page.
 */
export function BookDetail({ entry, onDeleted, onDuplicated }: Props) {
  const { book, status } = useLibraryBook(entry.id);

  return (
    <section aria-label={entry.name} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div>
        <h2 className="flex flex-wrap items-center gap-x-2.5 font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance text-foreground">
          <span className="min-w-0 break-words">{entry.name}</span>
          <SideTag side={entry.color} className="shrink-0 font-sans text-sm font-normal" />
        </h2>
        <div className="mt-1.5 flex flex-col gap-1">
          <BookTags origin={entry.origin} summary={entry.summary} />
          <OriginLine origin={entry.origin} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm">
          <Link href={libraryBookHref(entry.id)}>Open book page</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={explorerHref({ bookId: entry.id })}>Open in Explorer</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/train/${entry.id}`}>Train</Link>
        </Button>
        <BookMenu book={entry} onDeleted={onDeleted} onDuplicated={onDuplicated} />
      </div>
      <BookMeasures summary={entry.summary} />
      {book ? (
        <BookReader book={book} size="compact" fill board={false} />
      ) : status === "missing" || status === "failed" ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {status === "missing" ? "This book isn't in your library any more." : "The book couldn't be opened."}
        </p>
      ) : (
        <Skeleton className="min-h-64 w-full flex-1" />
      )}
    </section>
  );
}
