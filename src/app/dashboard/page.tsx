import { Badge } from "@/components/ui/Badge";

const stats = [
  { label: "Prepared books", value: "3" },
  { label: "Weekly streak", value: "5 days" },
  { label: "Puzzle rating", value: "1720" },
];

export default function DashboardPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <Badge>Overview</Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
          Training home
        </h1>
        <p className="max-w-2xl text-slate-600">
          Central hub for opening reps, puzzle practice, and long-term retention.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
