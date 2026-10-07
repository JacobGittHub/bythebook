import { notFound } from "next/navigation";
import { BookViewPage } from "@/components/books/BookViewPage";
import { isBookViewId } from "@/lib/books/views";

type Props = {
  params: Promise<{ view: string }>;
  /** `book` opens that book: an example book's id or one of the viewer's. */
  searchParams: Promise<{ book?: string }>;
};

// A small visualization: one book in one of the five book views, reached from the
// Visualizations page. The example books are static files, and the viewer's own are read in
// the browser, from the library.
export default async function BookViewRoute({ params, searchParams }: Props) {
  const [{ view }, { book }] = await Promise.all([params, searchParams]);
  if (!isBookViewId(view)) notFound();

  return (
    <div className="h-[calc(100dvh-var(--dash-offset))] min-h-0">
      <BookViewPage view={view} initialBookId={book ?? null} />
    </div>
  );
}
