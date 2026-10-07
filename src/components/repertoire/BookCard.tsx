import Link from "next/link";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { START_FEN } from "@/lib/chess/fen";
import type { LibraryEntry } from "@/lib/library/types";

export function BookCard({ book }: { book: LibraryEntry }) {
  return (
    <Link
      href={`/dashboard/train/${book.id}`}
      className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition-transform hover:-translate-y-0.5"
    >
      <BoardDisplay
        fen={START_FEN}
        size="sm"
        orientation={book.color === "black" ? "black" : "white"}
      />
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{book.name}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {book.summary.lines} line{book.summary.lines === 1 ? "" : "s"}, {book.summary.positions} position
          {book.summary.positions === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
