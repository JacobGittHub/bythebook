import { BookEditor } from "@/components/repertoire/BookEditor";
import { BookCard } from "@/components/repertoire/BookCard";
import { listOpeningBooks } from "@/lib/db/openings";

export default async function RepertoirePage() {
  const books = await listOpeningBooks();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Repertoire</h1>
        <p className="mt-2 text-slate-600">
          Manage opening books, branches, and imported lines.
        </p>
      </div>
      <BookEditor />
      <section className="grid gap-4 md:grid-cols-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </section>
    </main>
  );
}
