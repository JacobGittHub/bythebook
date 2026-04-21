import Link from "next/link";
import type { OpeningBook } from "@/types/chess";
import { BoardDisplay } from "@/components/board/BoardDisplay";

export function BookCard({ book }: { book: OpeningBook }) {
  return (
    <Link
      href={`/dashboard/train/${book.id}`}
      className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition-transform hover:-translate-y-0.5"
    >
      <BoardDisplay
        fen={book.rootFen}
        size="sm"
        orientation={book.color === "black" ? "black" : "white"}
      />
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{book.name}</h3>
        <p className="mt-2 text-sm text-slate-600">{book.description}</p>
      </div>
    </Link>
  );
}
