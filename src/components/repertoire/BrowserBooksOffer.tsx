"use client";

// The offer to copy a browser's books into the account (plans/deployment.md D22). A
// signed-in viewer whose browser still holds books from browsing as a guest sees a notice
// on every dashboard page, and the checklist on the Library page. A copied book leaves the
// browser once the account has it, so each book lives in one place; a book that can't be
// copied stays, with its reason. "Not now" lasts for the tab's session.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CopyChecklist } from "@/components/repertoire/CopyChecklist";
import { useBrowserBooksOffer, useLibrary } from "@/context/Library";
import { browserLibrary } from "@/lib/library/browserStore";
import { planCopy, toCandidate, type ExistingBook, type IncomingBook, type PlanItem } from "@/lib/library/copyPlan";
import { LibraryError, libraryErrorMessage, type BookDraft, type LibraryBook } from "@/lib/library/types";

const LIBRARY = "/dashboard/library";

const booksText = (count: number) => `${count} ${count === 1 ? "book" : "books"}`;

/** The notice on every dashboard page but the Library, which shows the checklist itself. */
export function BrowserBooksNotice() {
  const offer = useBrowserBooksOffer();
  const pathname = usePathname();
  if (!offer?.count || offer.dismissed || pathname === LIBRARY) return null;

  return (
    <aside
      aria-label="Books in this browser"
      className="fixed inset-x-3 bottom-3 z-20 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-lg sm:left-auto sm:max-w-sm"
    >
      <p className="text-sm text-[var(--text-primary)]">
        This browser holds {booksText(offer.count)} from browsing as a guest. Copy{" "}
        {offer.count === 1 ? "it" : "them"} into your account?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={LIBRARY} className="btn-primary rounded-xl px-3 py-1.5 text-sm font-medium">
          Open the Library to copy
        </Link>
        <button type="button" onClick={offer.dismiss} className="btn-secondary rounded-xl px-3 py-1.5 text-sm">
          Not now
        </button>
      </div>
    </aside>
  );
}

/** Every book in this browser, with its trees. */
async function readBrowserBooks(): Promise<LibraryBook[]> {
  const books: LibraryBook[] = [];
  for (const entry of await browserLibrary.list()) {
    const book = await browserLibrary.get(entry.id);
    if (book) books.push(book);
  }
  return books;
}

/** The checklist on the Library page, or a line that reopens it after "Not now". */
export function BrowserBooksCopy() {
  const offer = useBrowserBooksOffer();
  const { library } = useLibrary();
  const [checklist, setChecklist] = useState<{ plan: PlanItem[]; existing: ExistingBook[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = Boolean(offer?.count) && !offer?.dismissed;

  useEffect(() => {
    if (!open || checklist) return;
    let current = true;
    (async () => {
      try {
        const [books, entries] = await Promise.all([readBrowserBooks(), library.list()]);
        const existing = entries.map(({ id, name }) => ({ id, name }));
        if (current) setChecklist({ plan: planCopy(books.map(toCandidate), existing), existing });
      } catch (caught) {
        if (current) setError(libraryErrorMessage(caught));
      }
    })();
    return () => {
      current = false;
    };
  }, [open, checklist, library]);

  // An open checklist stays until Done, though its books leave the browser as they are copied.
  if (!offer || (!checklist && !offer.count)) return null;

  if (offer.dismissed && offer.count) {
    return (
      <p className="text-sm text-slate-500">
        This browser also holds {booksText(offer.count)} from browsing as a guest.{" "}
        <button type="button" onClick={offer.reopen} className="btn-ghost rounded-lg px-1 py-0.5 text-sm underline">
          Copy into your account
        </button>
      </p>
    );
  }

  if (error) {
    return (
      <p role="status" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
        The books in this browser couldn&apos;t be read: {error}
      </p>
    );
  }

  if (!checklist) return <p className="text-sm text-slate-400">Reading the books in this browser…</p>;

  // The account saves its copy first, so a book leaves the browser only once it is safe.
  const copy = async (draft: BookDraft, source: IncomingBook) => {
    await library.create(draft);
    try {
      await browserLibrary.remove(source.id);
    } catch (caught) {
      if (!(caught instanceof LibraryError && caught.code === "not_found")) {
        console.error("A copied book stayed in the browser too.", caught);
      }
    }
  };

  return (
    <CopyChecklist
      title={`Copy this browser's ${checklist.plan.length === 1 ? "book" : "books"} into your account`}
      plan={checklist.plan}
      existing={checklist.existing}
      verb="Copy"
      cancelLabel="Not now"
      save={copy}
      onDone={async () => {
        setChecklist(null);
        // What stays (skipped, refused or failed) is offered again next session.
        if (await offer.recount()) offer.dismiss();
      }}
    />
  );
}
