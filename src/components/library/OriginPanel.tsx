import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import type { BookOrigin } from "@/lib/library/types";
import { JumpTag, OriginLine, PublisherLabel, storeVerified } from "./BookParts";

const TITLES: Record<BookOrigin["kind"], string> = {
  own: "Your book",
  store: "From the Bookstore",
  combined: "Combined book",
  import: "Imported book",
};

/**
 * Where a book came from, on its own page (plans/deployment.md D24): its publisher and credit
 * for a store book, with the way back to the store's page for it.
 */
export function OriginPanel({ origin, storeHref }: { origin: BookOrigin; storeHref: string | null }) {
  return (
    <section aria-label="Where this book came from" className="flex flex-col gap-1.5 rounded-md border bg-card p-3 sm:max-w-md">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{TITLES[origin.kind]}</h2>
      {origin.kind === "store" && <PublisherLabel name={origin.publisher} verified={storeVerified(origin)} />}
      <OriginLine origin={origin} />
      {origin.kind !== "store" && (
        <p className="text-xs text-muted-foreground">Publishing your own books to the Bookstore comes later.</p>
      )}
      {storeHref && (
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href={storeHref}>
            Open in the Bookstore <JumpTag />
          </Link>
        </Button>
      )}
    </section>
  );
}
