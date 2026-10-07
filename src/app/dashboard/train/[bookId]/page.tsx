import { OpeningTrainer } from "@/components/training/OpeningTrainer";
import { getViewer } from "@/lib/auth/viewer";
import { getBook } from "@/lib/db/openings";
import { notFound } from "next/navigation";

export default async function TrainingSessionPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const [viewer, { bookId }] = await Promise.all([getViewer(), params]);
  // Books belong to accounts, so a guest has none to open.
  const book = viewer.signedIn ? await getBook(viewer.userId, bookId) : null;

  if (!book) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">{book.name}</h1>
        <p className="mt-2 text-slate-600">
          Active training session scaffold for book id <code>{bookId}</code>.
        </p>
      </div>
      <OpeningTrainer book={book} />
    </main>
  );
}
