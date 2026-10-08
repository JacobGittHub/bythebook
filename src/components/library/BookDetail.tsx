"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibraryBook } from "@/context/Library";
import { pathTo } from "@/lib/books/viewTree";
import { explorerHref, libraryBookHref } from "@/lib/library/links";
import type { LibraryEntry } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import { BookMenu } from "./BookMenu";
import { BookMeasures, BookTags, OriginLine, SideTag } from "./BookParts";
import { BookReader } from "./BookReader";
import { RemoveMoveButton } from "./RemoveMoveButton";

type Props = {
  entry: LibraryEntry;
  /** On a phone the list and a book take turns; this goes back to the list. */
  onBack: () => void;
  onDeleted: () => void;
  onDuplicated: (copy: LibraryEntry) => void;
  className?: string;
};

/**
 * The selected book beside the Library's list (plans/deployment.md D21, layout A): its name,
 * tags and measures, the ways out to its own page, the Explorer and the trainer, and the book
 * itself in a view beside a board.
 */
export function BookDetail({ entry, onBack, onDeleted, onDuplicated, className }: Props) {
  const { book, status, save } = useLibraryBook(entry.id);

  return (
    <section aria-label={entry.name} className={cn("flex min-w-0 flex-col gap-3 rounded-md border bg-card p-3", className)}>
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-1 self-start md:hidden">
        <ChevronLeft /> Library
      </Button>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
            <span className="truncate">{entry.name}</span>
            <SideTag side={entry.color} className="shrink-0 font-normal" />
          </h2>
          <BookTags origin={entry.origin} summary={entry.summary} />
          <OriginLine origin={entry.origin} className="mt-1" />
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
      </div>
      <BookMeasures summary={entry.summary} />
      {book ? (
        <BookReader
          book={book}
          size="compact"
          positionActions={(node) => (
            <div className="flex flex-col gap-1">
              <Button asChild size="sm" variant="outline">
                <Link href={explorerHref({ bookId: book.id, line: pathTo(node) })}>Open position in Explorer</Link>
              </Button>
              <RemoveMoveButton book={book} node={node} save={save} />
            </div>
          )}
        />
      ) : status === "missing" || status === "failed" ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {status === "missing" ? "This book isn't in your library any more." : "The book couldn't be opened."}
        </p>
      ) : (
        <Skeleton className="h-80 w-full md:h-[28rem]" />
      )}
    </section>
  );
}
