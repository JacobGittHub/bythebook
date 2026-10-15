import { StoreBookPage } from "@/components/library/StoreBookPage";
import { storeIdOfSlug } from "@/lib/library/links";
import { InterimSpread } from "@/components/book/Spread";

type Props = { params: Promise<{ slug: string }> };

/** A store book's page, the Bookstore's second level; the book is read in the browser (`useStoreBooks`). */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  return (
    <InterimSpread>
      <StoreBookPage storeId={storeIdOfSlug(slug)} />
    </InterimSpread>
  );
}
