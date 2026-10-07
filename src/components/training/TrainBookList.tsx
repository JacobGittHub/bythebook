"use client";

import { BookCard } from "@/components/repertoire/BookCard";
import { useLibraryBooks } from "@/context/Library";

/** The viewer's books to train, a guest's included, from the library. */
export function TrainBookList() {
  const { books, error } = useLibraryBooks();
  if (error) return <p className="text-sm text-slate-500">The books couldn&apos;t be read. Please reload.</p>;
  if (!books) return <p className="text-sm text-slate-400">Loading books…</p>;
  if (!books.length) return <p className="text-sm text-slate-500">No books yet. Make one in the Library.</p>;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </section>
  );
}
