import { BookstorePage } from "@/components/library/BookstorePage";
import { parseShelf } from "@/lib/library/search";

type Props = { searchParams: Promise<{ q?: string | string[]; side?: string | string[]; verified?: string | string[] }> };

// The shelf's search and filters are read here, not in the browser (`useSearchParams`), which
// would need a Suspense boundary around the page, as the Library's picked book is.
export default async function Page({ searchParams }: Props) {
  return <BookstorePage initialShelf={parseShelf(await searchParams)} />;
}
