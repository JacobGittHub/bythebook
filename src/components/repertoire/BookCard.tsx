import Link from "next/link";
import type { OpeningBook } from "@/types/chess";

export function BookCard({ book }: { book: OpeningBook }) {
  return (
    <Link
      href={`/dashboard/train/${book.id}`}
      className="rounded-3xl border border-slate-200 bg-white p-5 transition-transform hover:-translate-y-0.5"
    >
      <h3 className="text-lg font-semibold text-slate-900">{book.name}</h3>
      <p className="mt-2 text-sm text-slate-600">{book.description}</p>
    </Link>
  );
}
