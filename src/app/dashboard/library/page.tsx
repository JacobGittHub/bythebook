"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { BookEditor } from "@/components/repertoire/BookEditor";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { useViewer } from "@/context/Viewer";
import { START_FEN } from "@/lib/chess/fen";
import type { LibraryEntry } from "@/lib/library/types";

export default function LibraryPage() {
  const { signedIn } = useViewer();
  const [books, setBooks] = useState<LibraryEntry[]>([]);
  // A guest has no books on the server, so nothing is loaded for them.
  const [loading, setLoading] = useState(signedIn);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!signedIn) return;

    fetch("/api/openings/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const handleCreated = (book: LibraryEntry) => {
    setBooks((prev) => [book, ...prev]);
    setShowCreate(false);
  };

  const handleDelete = async (bookId: string) => {
    if (!confirm("Delete this book? This cannot be undone.")) return;
    const res = await fetch(`/api/openings/books/${bookId}`, { method: "DELETE" });
    // Already gone is as good as deleted.
    if (res.ok || res.status === 404) setBooks((prev) => prev.filter((b) => b.id !== bookId));
    else alert("The book couldn't be deleted. Please try again.");
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your own data: the opening books you build, and later your repertoires and games.
          </p>
        </div>
        {signedIn && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="btn-secondary rounded-2xl px-4 py-2 text-sm font-medium"
          >
            {showCreate ? "Cancel" : "+ New book"}
          </button>
        )}
      </div>

      {!signedIn && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">
            Books are saved to an account, so a guest&apos;s library is empty for now.
          </p>
          <SignInPrompt action="build and keep books" className="mt-2 text-sm" />
        </div>
      )}

      {showCreate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Create opening book</h2>
          <BookEditor onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Loading books…</p>
      )}

      {signedIn && !loading && books.length === 0 && !showCreate && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">No opening books yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary mt-3 rounded-2xl px-4 py-2 text-sm font-medium"
          >
            Create your first book
          </button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {books.map((book) => {
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
