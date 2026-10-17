import { notFound } from "next/navigation";
import { BookViewPage } from "@/components/books/BookViewPage";
import { isBookViewId } from "@/lib/books/views";

type Props = {
  params: Promise<{ view: string }>;
  /** `book` opens that book: an example book's id or one of the viewer's. */
  searchParams: Promise<{ book?: string }>;
};

// A book view's own page: one book in one of the five book views, a page of the
// Visualizations chapter. The example books are static files, and the viewer's own are read in
// the browser, from the library.
export default async function BookViewRoute({ params, searchParams }: Props) {
  const [{ view }, { book }] = await Promise.all([params, searchParams]);
  if (!isBookViewId(view)) notFound();

  return <BookViewPage key={view} view={view} initialBookId={book ?? null} />;
}
