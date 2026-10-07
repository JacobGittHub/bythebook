"use client";

import { OpeningTrainer } from "@/components/training/OpeningTrainer";
import { useLibraryBook } from "@/context/Library";

/** A training session on one of the viewer's books, opened from the library. */
export function TrainingSession({ bookId }: { bookId: string }) {
  const { book, status } = useLibraryBook(bookId);

  if (!book) {
    return (
      <main className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-950">Training</h1>
        <p className="text-sm text-slate-500">
          {status === "missing"
            ? "This book isn't in your library."
            : status === "failed"
              ? "The book couldn't be opened. Please reload."
              : "Loading the book…"}
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">{book.name}</h1>
        <p className="mt-2 text-slate-600">
          Active training session scaffold for book id <code>{book.id}</code>.
        </p>
      </div>
      <OpeningTrainer book={book} />
    </main>
  );
}
