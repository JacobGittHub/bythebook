import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { START_FEN } from "@/lib/chess/fen";
import type { LibraryEntry } from "@/lib/library/types";

export function BookCard({ book }: { book: LibraryEntry }) {
  return (
    <Link
      data-slot="panel"
      href={`/dashboard/train/${book.id}`}
      className="relative flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-foreground"
    >
      <BoardDisplay
        fen={START_FEN}
        size="sm"
        orientation={book.color === "black" ? "black" : "white"}
      />
      <div>
        <h3 className="font-heading font-semibold">{book.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {book.summary.lines} line{book.summary.lines === 1 ? "" : "s"}, {book.summary.positions} position
          {book.summary.positions === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
