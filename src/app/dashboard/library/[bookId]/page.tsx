import { LibraryBookPage } from "@/components/library/LibraryBookPage";

type Props = { params: Promise<{ bookId: string }> };

/** A book's own page, the Library's second level; the book is read in the browser (`useLibrary`). */
export default async function Page({ params }: Props) {
  const { bookId } = await params;
  return <LibraryBookPage bookId={decodeURIComponent(bookId)} />;
}
