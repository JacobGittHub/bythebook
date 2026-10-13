"use client";

import { BookCard } from "@/components/repertoire/BookCard";
import { useLibraryBooks } from "@/context/Library";

/** The viewer's books to train, a guest's included, from the library. */
export function TrainBookList() {
  const { books, error } = useLibraryBooks();
  if (error) return <p className="text-sm text-muted-foreground">The books couldn&apos;t be read. Please reload.</p>;
  if (!books) return <p className="text-sm text-muted-foreground">Loading books…</p>;
  if (!books.length) return <p className="text-sm text-muted-foreground">No books yet. Make one in the Library.</p>;
  return (
    <section className="grid gap-2 md:grid-cols-2">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </section>
  );
}
