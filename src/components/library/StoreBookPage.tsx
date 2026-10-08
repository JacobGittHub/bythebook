"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { EXAMPLE_METHOD_NOTES, exampleDraft } from "@/lib/books/examples";
import { pathTo } from "@/lib/books/viewTree";
import { explorerHref, libraryBookHref } from "@/lib/library/links";
import { fitBookName } from "@/lib/library/names";
import { libraryErrorMessage } from "@/lib/library/types";
import { BookMeasures, JumpTag, PublisherLabel, SideTag, storeVerified } from "./BookParts";
import { BookReader } from "./BookReader";
import { useStoreBooks } from "./useStoreBooks";

const STORE_NOTES = {
  browser: "Saving copies it into this browser's library.",
  account: "Saving copies it into your account's library.",
} as const;

/**
 * A store book's page, the Bookstore's second level (plans/bookstore.md D8, D14): its full
 * description, measures, the book in any of the five views, where it came from, and Save to
 * library, which copies it into the browser for a guest and into the account when signed in.
 */
export function StoreBookPage({ storeId }: { storeId: string }) {
  const { books, failed } = useStoreBooks();
  const { library, store } = useLibrary();
  const { books: own } = useLibraryBooks();
  const [saving, setSaving] = useState(false);
  const book = books?.find((candidate) => candidate.id === storeId) ?? null;
  // The library's copy of this book, if it has one (D5: a copy, not a link).
  const copy = own?.find((entry) => entry.origin.kind === "store" && entry.origin.sourceId === storeId) ?? null;

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href="/dashboard/bookstore">
        <ChevronLeft /> Bookstore
      </Link>
    </Button>
  );

  if (books === null && !failed) {
    return (
      <main className="flex flex-col gap-3">
        {back}
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-[34rem] w-full" />
      </main>
    );
  }
  if (!book) {
    return (
      <main className="flex flex-col gap-3">
        {back}
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {failed ? "The Bookstore's books didn't load." : "The Bookstore has no such book."}
        </p>
      </main>
    );
  }

  const save = async () => {
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

  return (
    <main className="flex flex-col gap-3">
      {back}
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold leading-tight text-foreground">
            <span className="truncate">{fitBookName(book.name)}</span>
            <SideTag side={book.color} className="shrink-0 text-sm font-normal" />
          </h1>
          {book.origin.kind === "store" && <PublisherLabel name={book.origin.publisher} verified={storeVerified(book.origin)} />}
          <p className="max-w-prose text-sm text-muted-foreground">{book.description}</p>
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

      <BookMeasures summary={book.summary} className="rounded-md border bg-card px-3 py-2" />

      <div className="rounded-md border bg-card p-3">
        <BookReader
          book={book}
          size="large"
          positionActions={(node) => (
            <Button asChild size="sm" variant="outline">
              <Link href={explorerHref({ line: pathTo(node) })}>Open position in Explorer</Link>
            </Button>
          )}
        />
      </div>

      <section aria-label="Where this book came from" className="flex flex-col gap-1.5 rounded-md border bg-card p-3 text-xs text-muted-foreground sm:max-w-xl">
        <h2 className="text-[11px] font-medium uppercase tracking-wide">How it was made</h2>
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
      </section>
    </main>
  );
}
