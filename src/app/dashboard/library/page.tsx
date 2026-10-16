import { LibraryPage } from "@/components/library/LibraryPage";

type Props = { searchParams: Promise<{ book?: string | string[] }> };

// The picked book is read here, not in the browser (`useSearchParams`), which would need a
// Suspense boundary around the page: one that showed nothing while the page's code loaded would
// start the turn without the arriving pages (plans/book-ui.md D14).
export default async function Page({ searchParams }: Props) {
  const { book } = await searchParams;
  return <LibraryPage initialBook={typeof book === "string" ? book : null} />;
}
