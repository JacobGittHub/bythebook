import type { OpeningBook } from "@/types/chess";

export function MoveTree({ book }: { book: OpeningBook }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Move tree</h3>
      <p className="mt-2 text-sm text-slate-600">
        {book.lines.length} prepared line{book.lines.length === 1 ? "" : "s"} in{" "}
        {book.name}.
      </p>
    </div>
  );
}
