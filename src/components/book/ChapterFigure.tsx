"use client";

import { useLibraryBooks } from "@/context/Library";

/**
 * The figure beside a chapter's name in the one-page form's column (plans/book-ui.md D15), as
 * a contents gives one: the Library's book count. Other chapters have none yet.
 */
export function ChapterFigure({ href }: { href: string }) {
  if (href === "/dashboard/library") return <LibraryCount />;
  return null;
}

function LibraryCount() {
  const { books } = useLibraryBooks();
  if (books === null) return null;
  return (
    <span className="book-chapter-text ml-auto font-mono text-[11.5px] font-normal tabular-nums">
      {books.length}
    </span>
  );
}
