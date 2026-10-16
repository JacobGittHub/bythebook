"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Ink } from "@/components/book/Book";
import { Spread } from "@/components/book/Spread";
import { useBrowserBooksCopy } from "@/components/repertoire/BrowserBooksOffer";
import { CopyChecklist } from "@/components/repertoire/CopyChecklist";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useBrowserBooksOffer, useLibrary, useLibraryBooks } from "@/context/Library";
import { useViewer } from "@/context/Viewer";
import {
  MAX_BACKUP_BYTES,
  backupAdvice,
  readBackup,
  writeBackup,
  type BackupAdvice,
  type BackupProblem,
} from "@/lib/library/backup";
import { browserKeepsData, browserLibrary } from "@/lib/library/browserStore";
import { planCopy, type ExistingBook, type PlanItem } from "@/lib/library/copyPlan";
import { libraryErrorMessage, type Library, type LibraryBook } from "@/lib/library/types";
import { BookDetail } from "./BookDetail";
import { countOf, originFolio, positionsOfLimit } from "./BookParts";
import { BookList } from "./BookList";
import { LibraryEmpty, StoreOffer } from "./LibraryEmpty";
import { NewBookDialog } from "./NewBookDialog";

const BACKUP_PROBLEMS: Record<BackupProblem, string> = {
  too_large: "That file is too large to be a library backup.",
  not_backup: "That file isn't a ByTheBook library backup.",
  newer_version: "That backup was made by a newer version of ByTheBook. Reload the page and try again.",
  damaged: "That backup is damaged: its contents don't match its checksum, so nothing was restored.",
};

/** Hands the browser a file to save. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The backup notice's text (bookstore.md D12): when the library was last backed up, and why it matters. */
function adviceText(advice: BackupAdvice): string {
  const when = advice.lastBackupAt
    ? new Date(advice.lastBackupAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;
  const sentences = [
    when
      ? advice.changed
        ? `Last backed up ${when}, and books have changed since.`
        : `Last backed up ${when}.`
      : "These books haven't been backed up yet.",
  ];
  if (advice.mayBeDeleted) {
    sentences.push(
      "This browser hasn't promised to keep them: some browsers, Safari among them, delete a site's data after 7 days without a visit.",
    );
  }
  sentences.push(advice.changed ? "Back up to keep a copy in a file." : "Your backup file holds them all.");
  return sentences.join(" ");
}

/** Whether a press is meant for a new tab or window, which a link keeps doing. */
const opensElsewhere = (event: MouseEvent) => event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

/**
 * The Library's first level as a spread (plans/book-ui.md D8): the books as contents on the
 * left page, under New book, Back up and Restore, the backup notice and the copy at sign-in;
 * the picked book on the right, or a restore or copy checklist while one is open. The picked
 * book is kept in the address (`?book=`), which the page reads as `initialBook`. Where the halves stack, on a phone, the right page doesn't
 * show, and a book's row opens its own page instead. Debug mode adds the browser library's panel.
 */
export function LibraryPage({ initialBook }: { initialBook: string | null }) {
  const { library, store, label } = useLibrary();
  const { books, error, reload } = useLibraryBooks();
  const { debug, signedIn } = useViewer();
  const offer = useBrowserBooksOffer();
  const copy = useBrowserBooksCopy();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [restore, setRestore] = useState<{ plan: PlanItem[]; existing: ExistingBook[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const shown = useRef<HTMLDivElement>(null);
  const [advice, setAdvice] = useState<BackupAdvice | null>(null);
  const [backups, setBackups] = useState(0);
  // Whether the reader picked the book shown, as against the first one shown at the start.
  const [picked, setPicked] = useState(false);
  const [wanted, setWanted] = useState(initialBook);

  const selected = books?.find((book) => book.id === wanted) ?? books?.[0] ?? null;

  const select = (bookId: string | null) => {
    window.history.replaceState(null, "", bookId ? `?book=${encodeURIComponent(bookId)}` : window.location.pathname);
    setWanted(bookId);
    setPicked(true);
  };

  // A row picks its book where the right page shows; where it doesn't, its link goes to the book.
  const pick = (bookId: string, event: MouseEvent) => {
    if (opensElsewhere(event) || !shown.current || shown.current.getClientRects().length === 0) return;
    event.preventDefault();
    select(bookId);
  };

  // The backup notice for a browser library, read again after every change and backup.
  useEffect(() => {
    if (store !== "browser" || books === null) return;
    let current = true;
    Promise.all([browserLibrary.backupState(), browserKeepsData()]).then(
      ([state, kept]) => {
        if (current) setAdvice(backupAdvice(books.length, state, kept));
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [store, books, backups]);

  /** Downloads every book in `source`: the viewer's library, or in debug mode this browser's. */
  const backUp = async (source: Library) => {
    setBusy("backup");
    try {
      const full: LibraryBook[] = [];
      for (const entry of await source.list()) {
        const book = await source.get(entry.id);
        if (book) full.push(book);
      }
      const now = new Date();
      download(await writeBackup(full, now), `bythebook-library-${now.toISOString().slice(0, 10)}.json`);
      if (source.store === "browser") {
        await browserLibrary.recordBackup(now);
        setBackups((count) => count + 1);
      }
      toast.success(`Backed up ${full.length} ${full.length === 1 ? "book" : "books"}.`);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const readRestoreFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setBusy("restore");
    try {
      if (file.size > MAX_BACKUP_BYTES) return void toast.error(BACKUP_PROBLEMS.too_large);
      const read = await readBackup(await file.text());
      if (!read.ok) return void toast.error(BACKUP_PROBLEMS[read.problem]);
      const existing = (await library.list()).map(({ id, name }) => ({ id, name }));
      setRestore({ plan: planCopy(read.books, existing), existing });
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  /** Debug mode: deletes every book kept in this browser (D23). */
  const emptyBrowserLibrary = async () => {
    try {
      await browserLibrary.empty();
      if (store === "browser") await reload();
      else await offer?.recount();
      setBackups((count) => count + 1);
      toast.success("Emptied the browser library.");
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    }
  };

  const openRestore = () => fileInput.current?.click();
  const empty = books !== null && books.length === 0;
  const positions = (books ?? []).reduce((sum, book) => sum + book.summary.positions, 0);
  const browserBookCount = store === "browser" ? (books?.length ?? null) : (offer?.count ?? null);
  const copyChecklist = store === "account" ? copy.checklist : null;
  const copyNotice = store === "account" ? copy.notice : null;

  const left = (
    <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">Your books</h1>
        <span className="grow" />
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openRestore} disabled={busy !== null || restore !== null}>
            <Upload /> {busy === "restore" ? "Reading…" : "Restore"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void backUp(library)} disabled={busy !== null || !books?.length}>
            <Download /> {busy === "backup" ? "Backing up…" : "Back up"}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New book
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="Backup file to restore"
          className="hidden"
          onChange={(event) => void readRestoreFile(event.target.files?.[0])}
        />
      </header>

      {store === "browser" && advice && !empty && (
        <div className="flex flex-wrap items-center gap-2 border-y border-rule py-2">
          <p className="min-w-0 flex-1 basis-64 text-xs text-foreground">{adviceText(advice)}</p>
          {advice.changed && (
            <Button size="sm" onClick={() => void backUp(library)} disabled={busy !== null}>
              Back up now
            </Button>
          )}
          {!signedIn && (
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/register">Create account</Link>
            </Button>
          )}
        </div>
      )}

      {copyNotice}

      {books === null && !error && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          The books couldn&apos;t be read.
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}

      {empty && <LibraryEmpty onNewBook={() => setCreating(true)} onRestore={openRestore} restoreBusy={busy === "restore"} />}

      {books && books.length > 0 && (
        <>
          <BookList books={books} selectedId={selected?.id ?? null} onPick={pick} />
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Game history</span> · coming soon: import your own games to see
            where you left the book.
          </p>
        </>
      )}

      {debug && (
        <section aria-label="Debug: browser library" className="mt-auto border-t border-dashed border-rule pt-2">
          <p className="book-sc">Debug: browser library</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This browser holds {browserBookCount === null ? "an unknown number of" : browserBookCount}{" "}
            {browserBookCount === 1 ? "book" : "books"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void backUp(browserLibrary)}
              disabled={busy !== null || !browserBookCount}
            >
              Back up browser library
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy !== null || !browserBookCount}>
                  Empty browser library
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty the browser library?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every book kept in this browser is deleted. Back it up first if you need it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void emptyBrowserLibrary()}>
                    Empty it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      )}

      <NewBookDialog open={creating} onOpenChange={setCreating} onCreated={(entry) => select(entry.id)} />
    </div>
  );

  // The right page: a checklist while one is open, else the picked book, or the Bookstore's
  // books for an empty library.
  let right: ReactNode = null;
  let rightHead: ReactNode = null;
  let rightFolio: ReactNode = null;
  // Stacked on a phone, the picked book doesn't show under the list; anything else does.
  let stack: "both" | "left" = "both";
  if (restore) {
    right = (
      <div className="min-h-0 overflow-y-auto">
        <CopyChecklist
          title="Restore from a backup"
          plan={restore.plan}
          existing={restore.existing}
          verb="Restore"
          save={(draft) => library.create(draft)}
          onDone={() => setRestore(null)}
        />
      </div>
    );
  } else if (copyChecklist) {
    right = <div className="min-h-0 overflow-y-auto">{copyChecklist}</div>;
  } else if (books === null && !error) {
    right = <Skeleton className="min-h-64 w-full flex-1" />;
  } else if (empty) {
    right = <StoreOffer />;
    rightHead = <span className="ml-auto">Bookstore</span>;
  } else if (selected) {
    stack = "left";
    right = (
      <Ink key={selected.id} inked={picked} className="flex min-h-0 flex-1 flex-col">
        <BookDetail entry={selected} onDeleted={() => select(null)} onDuplicated={(copied) => select(copied.id)} />
      </Ink>
    );
    rightHead = (
      <>
        <span className="book-sc">{selected.color === "white" ? "White" : "Black"}</span>
        <span className="grow" />
        <span className="truncate">{selected.name}</span>
      </>
    );
    rightFolio = (
      <>
        <span>{originFolio(selected.origin)}</span>
        <span className="grow" />
        <span>{positionsOfLimit(selected.summary)}</span>
      </>
    );
  }

  return (
    <Spread
      stack={stack}
      left={{
        head: (
          <>
            <span>Library</span>
            <span className="grow" />
            <span className="book-sc">{label}</span>
          </>
        ),
        body: left,
        folio: books && books.length > 0 && (
          <>
            <span>{countOf(books.length, "book")}</span>
            <span className="grow" />
            <span>{positions.toLocaleString("en-US")} positions in all</span>
          </>
        ),
      }}
      right={{
        head: rightHead,
        body: (
          <div ref={shown} className="flex min-h-0 flex-1 flex-col">
            {right}
          </div>
        ),
        folio: rightFolio,
      }}
    />
  );
}
