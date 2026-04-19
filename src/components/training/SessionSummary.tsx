import type { SessionResult } from "@/types/training";

export function SessionSummary({ result }: { result: SessionResult }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Latest summary</h3>
      <p className="mt-2 text-sm text-slate-600">
        Accuracy {result.accuracy}% across {result.completedLines} completed lines.
      </p>
    </div>
  );
}
