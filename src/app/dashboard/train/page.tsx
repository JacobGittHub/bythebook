import { BookCard } from "@/components/repertoire/BookCard";
import { auth, getSessionUserId } from "@/lib/auth";
import { listOpeningBooks } from "@/lib/db/openings";

export default async function TrainPage() {
  const books = await listOpeningBooks(getSessionUserId(await auth()) ?? undefined);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Select a training book</h1>
        <p className="mt-2 text-slate-600">
          Choose the repertoire branch you want to drill today.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </section>
    </main>
  );
}
