"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { BrowserBooksCopy } from "@/components/repertoire/BrowserBooksOffer";
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
import { Badge } from "@/components/shadcn/badge";
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
import { cn } from "@/lib/utils";
import { BookDetail } from "./BookDetail";
import { countOf } from "./BookParts";
import { BookList } from "./BookList";
import { LibraryEmpty } from "./LibraryEmpty";
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

const isNarrow = () => window.matchMedia("(max-width: 767px)").matches;

/**
 * The Library's first level (plans/deployment.md D21, layout A): the book list beside the
 * selected book, with New book, Back up and Restore, the backup notice, the copy at sign-in
 * and, in debug mode, the browser library's panel. The selected book is in the address
 * (`?book=`), so Back returns to the list on a phone.
 */
export function LibraryPage() {
  const { library, store, label } = useLibrary();
  const { books, error, reload } = useLibraryBooks();
  const { debug, signedIn } = useViewer();
  const offer = useBrowserBooksOffer();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [restore, setRestore] = useState<{ plan: PlanItem[]; existing: ExistingBook[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [advice, setAdvice] = useState<BackupAdvice | null>(null);
  const [backups, setBackups] = useState(0);

  const wanted = params.get("book");
  const listed = books?.find((book) => book.id === wanted) ?? null;
  // Wide, the first book shows when none is named; on a phone the list shows instead.
  const selected = listed ?? books?.[0] ?? null;

  const select = (bookId: string | null) => {
    const href = bookId ? `?book=${encodeURIComponent(bookId)}` : window.location.pathname;
    // On a phone a book replaces the list, so it gets its own history entry for Back.
    if (bookId && isNarrow()) window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
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

  return (
    <main className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Library</h1>
        {books && books.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {countOf(books.length, "book")} · {countOf(positions, "position")}
          </span>
        )}
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", store === "browser" ? "bg-[var(--view-clash)]" : "bg-[var(--fam-1)]")}
          />
          {label}
        </Badge>
        <span className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
          <p className="min-w-0 flex-1 basis-80 text-sm text-foreground">{adviceText(advice)}</p>
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

      {store === "account" && <BrowserBooksCopy />}

      {restore && (
        <CopyChecklist
          title="Restore from a backup"
          plan={restore.plan}
          existing={restore.existing}
          verb="Restore"
          save={(draft) => library.create(draft)}
          onDone={() => setRestore(null)}
        />
      )}

      {books === null && !error && (
        <div className="grid gap-3 md:grid-cols-[19rem_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="hidden h-96 md:block" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          The books couldn&apos;t be read.
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}

      {empty && <LibraryEmpty onNewBook={() => setCreating(true)} onRestore={openRestore} restoreBusy={busy === "restore"} />}

      {books && books.length > 0 && (
        <div className="grid items-start gap-3 md:grid-cols-[19rem_1fr]">
          <div className={cn("flex min-w-0 flex-col gap-2", listed && "hidden md:flex")}>
            <BookList books={books} selectedId={selected?.id ?? null} onSelect={select} />
            <p className="px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Game history</span> · coming soon: import your own games to
              see the moves you play beside the master statistics.
            </p>
          </div>
          {selected && (
            <BookDetail
              key={selected.id}
              entry={selected}
              onBack={() => window.history.back()}
              onDeleted={() => select(null)}
              onDuplicated={(copy) => select(copy.id)}
              className={cn(!listed && "hidden md:flex")}
            />
          )}
        </div>
      )}

      {debug && (
        <section aria-label="Debug: browser library" className="rounded-md border border-dashed px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debug: browser library</p>
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
    </main>
  );
}
