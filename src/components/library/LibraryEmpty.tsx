"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookMiniature } from "@/components/books/BookMiniature";
import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useLibrary } from "@/context/Library";
import { exampleDraft } from "@/lib/books/examples";
import { libraryErrorMessage } from "@/lib/library/types";
import { JumpTag, PublisherLabel, SideTag, countOf, storeVerified } from "./BookParts";
import { useStoreBooks } from "./useStoreBooks";

type Props = {
  onNewBook: () => void;
  onRestore: () => void;
  restoreBusy: boolean;
};

/**
 * A first visit to an empty library (plans/deployment.md D24): make a book, restore a backup
 * when arriving from another browser, or save one of the Bookstore's books.
 */
export function LibraryEmpty({ onNewBook, onRestore, restoreBusy }: Props) {
  const { library, store } = useLibrary();
  const { books, failed } = useStoreBooks();
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (id: string) => {
    const book = books?.find((candidate) => candidate.id === id);
    if (!book) return;
    setSaving(id);
    try {
      await library.create(exampleDraft(book));
      toast.success(`Saved ${book.name} to your library.`);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-md border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your library is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {store === "browser"
              ? "Books you make or save are kept in this browser until you back them up to a file or create an account."
              : "Books you make or save are kept in your account."}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Make a book</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Name it and pick a side. Then the Explorer opens with your book chosen: play a line on the board and add it.
            New book also takes pasted moves or a PGN.
          </p>
          <Button className="mt-2" size="sm" onClick={onNewBook}>
            New book
          </Button>
        </div>
        <Separator />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Moving from another browser?</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Restore a backup file to bring your books here.</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={onRestore} disabled={restoreBusy}>
            {restoreBusy ? "Reading…" : "Restore a backup"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-foreground">From the Bookstore</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/bookstore">
              Open the Bookstore <JumpTag />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ready-made books to save and edit. Saving copies a book into your library, and a book from Wikibooks keeps its
          credit.
        </p>
        {failed && <p className="text-sm text-muted-foreground">The Bookstore&apos;s books didn&apos;t load.</p>}
        <ul aria-label="Bookstore books" className="divide-y">
          {books === null && !failed
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="py-2">
                  <Skeleton className="h-9 w-full" />
                </li>
              ))
            : (books ?? []).map((book) => (
                <li key={book.id} className="flex items-center gap-2.5 py-2">
                  <BookMiniature miniature={book.summary.miniature} width={46} height={30} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{book.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <SideTag side={book.color} /> · <span className="tabular-nums">{countOf(book.summary.positions, "position")}</span>
                    </span>
                  </div>
                  {book.origin.kind === "store" && (
                    <span className="hidden sm:inline-flex">
                      <PublisherLabel name={book.origin.publisher} verified={storeVerified(book.origin)} />
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void save(book.id)}
                    disabled={saving !== null}
                    aria-label={`Save ${book.name}`}
                  >
                    {saving === book.id ? "Saving…" : "Save"}
                  </Button>
                </li>
              ))}
        </ul>
      </section>
    </div>
  );
}
