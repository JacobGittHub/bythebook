import { notFound } from "next/navigation";
import { BookViewPage } from "@/components/books/BookViewPage";
import { getViewer } from "@/lib/auth/viewer";
import { isBookViewId } from "@/lib/books/views";
import { listBooksWithTrees } from "@/lib/db/openings";

type Props = {
  params: Promise<{ view: string }>;
  /** `book` opens that book: an example book's id or one of the viewer's. */
  searchParams: Promise<{ book?: string }>;
};

// A small visualization: one book in one of the five book views, reached from the
// Visualizations page.
export default async function BookViewRoute({ params, searchParams }: Props) {
  const [{ view }, { book }, viewer] = await Promise.all([params, searchParams, getViewer()]);
  if (!isBookViewId(view)) notFound();
  // A guest has no books, so the database isn't asked; the example books are static files.
  const books = viewer.signedIn ? await listBooksWithTrees(viewer.userId) : [];

  return (
    <div className="h-[calc(100dvh-var(--dash-offset))] min-h-0">
      <BookViewPage view={view} initialBooks={books} initialBookId={book ?? null} />
    </div>
  );
}
