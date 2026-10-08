import { Suspense } from "react";
import { LibraryPage } from "@/components/library/LibraryPage";

// The selected book is read from the address in the browser (`useSearchParams`), so the page
// renders inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <LibraryPage />
    </Suspense>
  );
}
