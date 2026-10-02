import Link from "next/link";

export default function BookstorePage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--text-primary)]">Bookstore</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Ready-made opening books that anyone can add to their library.
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-[var(--border-card)] p-8 text-center">
        <p className="font-semibold text-[var(--text-primary)]">Coming soon</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)]">
          The Bookstore will offer default books such as the Queen&apos;s Gambit or a set of
          gambits. Until then, browse every named opening in the{" "}
          <Link
            className="font-medium text-[var(--text-primary)] underline"
            href="/dashboard/visualizations/treemap"
          >
            Treemap
          </Link>{" "}
          or the{" "}
          <Link
            className="font-medium text-[var(--text-primary)] underline"
            href="/dashboard/explorer"
          >
            Explorer
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
