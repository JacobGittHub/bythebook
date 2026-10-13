"use client";

import { OpeningTrainer } from "@/components/training/OpeningTrainer";
import { useLibraryBook } from "@/context/Library";

/** A training session on one of the viewer's books, opened from the library. */
export function TrainingSession({ bookId }: { bookId: string }) {
  const { book, status } = useLibraryBook(bookId);

  if (!book) {
    return (
      <main className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Training</h1>
        <p className="text-sm text-muted-foreground">
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
    <main className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{book.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active training session scaffold for book id <code>{book.id}</code>.
        </p>
      </div>
      <OpeningTrainer book={book} />
    </main>
  );
}
