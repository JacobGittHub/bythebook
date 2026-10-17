"use client";

import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/shadcn/native-select";
import type { ExampleBookEntry } from "@/lib/books/examples";
import type { BookSide } from "@/lib/books/measures";

/** The first book a visitor sees, on a page that draws one book. */
export const FIRST_EXAMPLE_BOOK = "example:queens-gambit";

type Props = {
  value: string;
  onChange: (bookId: string) => void;
  /** The example books, once their list has loaded. */
  examples: readonly ExampleBookEntry[] | null;
  /** The viewer's own books, a guest's included, from the library. */
  ownBooks: readonly { id: string; name: string; color: BookSide }[] | null;
};

/** A "Book" menu of the example books and the viewer's own, as a page that draws one book has. */
export function BookSelect({ value, onChange, examples, ownBooks }: Props) {
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      Book
      <NativeSelect
        aria-label="Book"
        size="sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        wrapperClassName="min-w-0 max-w-64"
        className="h-7 pl-1.5 pr-7 text-xs"
      >
        <NativeSelectOptGroup label="Examples">
          {(examples ?? []).map((entry) => (
            <NativeSelectOption key={entry.id} value={entry.id}>
              {entry.name} ({entry.color})
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
        {ownBooks && ownBooks.length > 0 && (
          <NativeSelectOptGroup label="Your books">
            {ownBooks.map((own) => (
              <NativeSelectOption key={own.id} value={own.id}>
                {own.name} ({own.color})
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}
      </NativeSelect>
    </label>
  );
}
