"use client";

import { useLibraryBooks } from "@/context/Library";
import { VISUALIZATIONS } from "@/lib/auth/access";

const FIGURE = "book-chapter-text ml-auto font-mono text-[11.5px] font-normal tabular-nums";

/**
 * The figure beside a chapter's name in the one-page form's column (plans/book-ui.md D15), as
 * a contents gives one: the Library's book count, and how many visualizations there are. Other
 * chapters have none yet.
 */
export function ChapterFigure({ href }: { href: string }) {
  if (href === "/dashboard/library") return <LibraryCount />;
  if (href === "/dashboard/visualizations") return <span className={FIGURE}>{VISUALIZATIONS.length}</span>;
  return null;
}

function LibraryCount() {
  const { books } = useLibraryBooks();
  if (books === null) return null;
  return <span className={FIGURE}>{books.length}</span>;
}
