"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { fetchExampleBook, useExampleBooks } from "@/components/books/useExampleBooks";
import { BookEditor } from "@/components/repertoire/BookEditor";
import { CopyChecklist } from "@/components/repertoire/CopyChecklist";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { exampleDraft, type ExampleBookEntry } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { MAX_BACKUP_BYTES, readBackup, writeBackup, type BackupProblem } from "@/lib/library/backup";
import { browserLibrary } from "@/lib/library/browserStore";
import { planCopy, type ExistingBook, type PlanItem } from "@/lib/library/copyPlan";
import { LibraryError, libraryErrorMessage, type LibraryBook } from "@/lib/library/types";

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

export default function LibraryPage() {
  const { library, store, label } = useLibrary();
  const { books, error, reload } = useLibraryBooks();
  const { entries: examples } = useExampleBooks(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [savingExample, setSavingExample] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ plan: PlanItem[]; existing: ExistingBook[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleDelete = async (bookId: string) => {
    if (!confirm("Delete this book? This cannot be undone.")) return;
    try {
      await library.remove(bookId);
    } catch (caught) {
      // Already gone is as good as deleted.
      if (!(caught instanceof LibraryError && caught.code === "not_found")) setNotice(libraryErrorMessage(caught));
    }
  };

  const backUp = async () => {
    setBusy("backup");
    setNotice(null);
    try {
      const full: LibraryBook[] = [];
      for (const entry of await library.list()) {
        const book = await library.get(entry.id);
        if (book) full.push(book);
      }
      const now = new Date();
      download(await writeBackup(full, now), `bythebook-library-${now.toISOString().slice(0, 10)}.json`);
      if (store === "browser") await browserLibrary.recordBackup(now);
      setNotice(`Backed up ${full.length} ${full.length === 1 ? "book" : "books"}.`);
    } catch (caught) {
      setNotice(libraryErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const readRestoreFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setBusy("restore");
    setNotice(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        setNotice(BACKUP_PROBLEMS.too_large);
        return;
      }
      const read = await readBackup(await file.text());
      if (!read.ok) {
        setNotice(BACKUP_PROBLEMS[read.problem]);
        return;
      }
      const existing = (await library.list()).map(({ id, name }) => ({ id, name }));
      setRestore({ plan: planCopy(read.books, existing), existing });
    } catch (caught) {
      setNotice(libraryErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const saveExample = async (entry: ExampleBookEntry) => {
    setSavingExample(entry.id);
    setNotice(null);
    try {
      await library.create(exampleDraft(await fetchExampleBook(entry)));
    } catch (caught) {
      setNotice(caught instanceof LibraryError ? libraryErrorMessage(caught) : "The example book didn't load. Please try again.");
    } finally {
      setSavingExample(null);
    }
  };

  const empty = books !== null && books.length === 0;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your own data: the opening books you build, and later your repertoires and games.
          </p>
          <p className="mt-2 inline-block rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
            {label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="btn-secondary rounded-2xl px-4 py-2 text-sm font-medium"
          >
            {showCreate ? "Cancel" : "+ New book"}
          </button>
          <button
            onClick={backUp}
            disabled={busy !== null || !books?.length}
            className="btn-secondary rounded-2xl px-4 py-2 text-sm"
          >
            {busy === "backup" ? "Backing up…" : "Back up"}
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null || restore !== null}
            className="btn-secondary rounded-2xl px-4 py-2 text-sm"
          >
            {busy === "restore" ? "Reading…" : "Restore"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Backup file to restore"
            className="hidden"
            onChange={(event) => void readRestoreFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {store === "browser" && (
        <p className="text-sm text-slate-500">
          These books are kept in this browser only, so another browser or device won&apos;t see them, and
          clearing this site&apos;s data deletes them. Back up to a file to keep a copy.
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
          {notice}
        </p>
      )}

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

      {showCreate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Create opening book</h2>
          <BookEditor onCreated={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {books === null && !error && <p className="text-sm text-slate-400">Loading books…</p>}

      {error && (
        <div className="rounded-3xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          The books couldn&apos;t be read.{" "}
          <button onClick={() => void reload()} className="btn-ghost rounded-lg px-2 py-1 text-sm underline">
            Try again
          </button>
        </div>
      )}

      {empty && !showCreate && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8">
          <div className="text-center">
            <p className="text-sm text-slate-500">No opening books yet.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary rounded-2xl px-4 py-2 text-sm font-medium"
              >
                Create your first book
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={busy !== null}
                className="btn-secondary rounded-2xl px-4 py-2 text-sm"
              >
                Restore from a backup
              </button>
            </div>
          </div>
          {examples && examples.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-800">Or start from an example book</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {examples.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{entry.name}</p>
                      <p className="text-xs text-slate-500">
                        <span className="capitalize">{entry.color}</span> · {entry.positions} positions
                      </p>
                    </div>
                    <button
                      onClick={() => void saveExample(entry)}
                      disabled={savingExample !== null}
                      aria-label={`Save ${entry.name}`}
                      className="btn-secondary shrink-0 rounded-xl px-3 py-1.5 text-xs"
                    >
                      {savingExample === entry.id ? "Saving…" : "Save"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {(books ?? []).map((book) => {
          const { lines: lineCount, positions: nodeCount } = book.summary;
          return (
            <article
              key={book.id}
              className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5"
            >
              <BoardDisplay
                fen={START_FEN}
                size="sm"
                orientation={book.color}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{book.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-500 capitalize">{book.color}</p>
                  {book.origin.kind === "store" && (
                    <p className="mt-0.5 text-xs text-slate-500">From {book.origin.publisher}</p>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
                  <span>{nodeCount} {nodeCount === 1 ? "position" : "positions"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/visualizations/treemap?bookId=${book.id}`}
                    className="btn-primary rounded-xl px-3 py-1.5 text-xs font-medium"
                  >
                    View in tree
                  </Link>
                  <Link
                    href={`/dashboard/train/${book.id}`}
                    className="btn-secondary rounded-xl px-3 py-1.5 text-xs"
                  >
                    Train
                  </Link>
                  <Link
                    href="/dashboard/explorer"
                    className="btn-secondary rounded-xl px-3 py-1.5 text-xs"
                  >
                    Explorer
                  </Link>
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="ml-auto rounded-xl border border-red-300 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:border-red-400/60 dark:text-red-400 dark:hover:text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Game history */}
      <section className="rounded-3xl border border-dashed border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Game history</h2>
          <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
            Coming soon
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Import your own games to see the moves you play beside the master statistics.
        </p>
      </section>
    </main>
  );
}
