import { StoreBookPage } from "@/components/library/StoreBookPage";
import { storeIdOfSlug } from "@/lib/library/links";
import { parseShelf } from "@/lib/library/search";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string | string[]; side?: string | string[]; verified?: string | string[] }>;
};

/**
 * A store book's page, the Bookstore's second level, with the shelf's search and filters for the
 * list beside it; the book is read in the browser (`useStoreBooks`).
 */
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  return <StoreBookPage storeId={storeIdOfSlug(slug)} shelf={parseShelf(await searchParams)} />;
}
