"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { BookEditor } from "@/components/repertoire/BookEditor";
import { countMoveTreeLines, countMoveTreeNodes } from "@/lib/chess/moveTree";
import type { OpeningBook } from "@/types/chess";

export default function RepertoirePage() {
  const [books, setBooks] = useState<OpeningBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/openings/books")
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (book: OpeningBook) => {
    setBooks((prev) => [book, ...prev]);
    setShowCreate(false);
  };

  const handleDelete = async (bookId: string) => {
    if (!confirm("Delete this book? This cannot be undone.")) return;
    // API delete not yet implemented — optimistic UI removal
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Repertoire</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your opening books and navigate to the explorer or trainer.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showCreate ? "Cancel" : "+ New book"}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Create opening book</h2>
          <BookEditor onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Loading books…</p>
      )}

      {!loading && books.length === 0 && !showCreate && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">No opening books yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Create your first book
          </button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {books.map((book) => {
          const lineCount = countMoveTreeLines(book.moveNode);
          const nodeCount = countMoveTreeNodes(book.moveNode);
          return (
            <article
              key={book.id}
              className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5"
            >
              <BoardDisplay
                fen={book.rootFen}
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
                    href={`/dashboard?bookId=${book.id}`}
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    View in tree
                  </Link>
                  <Link
                    href={`/dashboard/train/${book.id}`}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Train
                  </Link>
                  <Link
                    href="/dashboard/explorer"
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Explorer
                  </Link>
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="ml-auto rounded-xl border border-red-100 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
