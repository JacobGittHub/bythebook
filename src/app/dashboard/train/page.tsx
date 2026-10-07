import { BookCard } from "@/components/repertoire/BookCard";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getViewer } from "@/lib/auth/viewer";
import { listBooks } from "@/lib/db/openings";

export default async function TrainPage() {
  const viewer = await getViewer();
  // Training drills a user's own books, and a guest has none, so the database isn't asked.
  const books = viewer.signedIn ? await listBooks(viewer.userId) : [];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Select a training book</h1>
        <p className="mt-2 text-slate-600">
          Choose the repertoire branch you want to drill today.
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-800">Coming soon</p>
        <p className="mt-1 text-sm text-slate-500">
          The trainer is still being built. What is here is an early scaffold.
        </p>
        {!viewer.signedIn && (
          <SignInPrompt action="build the books that training will drill" className="mt-2 text-sm" />
        )}
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </section>
    </main>
  );
}
