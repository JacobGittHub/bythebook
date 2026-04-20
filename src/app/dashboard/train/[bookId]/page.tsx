import { OpeningTrainer } from "@/components/training/OpeningTrainer";
import { getOpeningBook } from "@/lib/db/openings";
import { notFound } from "next/navigation";

export default async function TrainingSessionPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getOpeningBook(bookId);

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
