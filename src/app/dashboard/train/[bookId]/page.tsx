import { TrainingSession } from "@/components/training/TrainingSession";
import { InterimSpread } from "@/components/book/Spread";

// One book's training session. The book is read in the browser, from the library, since a
// guest's books are kept there.
export default async function TrainingSessionPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return (
    <InterimSpread>
      <TrainingSession bookId={bookId} />
    </InterimSpread>
  );
}
