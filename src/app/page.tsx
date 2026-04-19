import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const pillars = [
  "Train against your opening tree",
  "Track mistakes by branch and position",
  "Review with explorer and engine hooks",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
              ByTheBook
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Build a serious opening trainer.
            </h1>
          </div>
          <div className="flex gap-3">
            <Button href="/auth/login" variant="ghost">
              Sign in
            </Button>
            <Button href="/auth/register">Create account</Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Badge>Opening prep, puzzle reps, spaced review</Badge>
            <div className="space-y-4">
              <h2 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
                A scaffold for chess study that feels like training, not admin.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                This starter maps your app shell, APIs, domain types, hooks, and
                placeholders so we can wire up Lichess, Stockfish, auth, and persistence
                next.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/dashboard">Open dashboard</Button>
              <Button href="/dashboard/train" variant="secondary">
                Browse training routes
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="grid gap-4">
              {pillars.map((pillar) => (
                <div
                  key={pillar}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-700"
                >
                  {pillar}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-6 text-slate-100">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                Planned sections
              </p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <Link href="/dashboard/repertoire">Repertoire manager</Link>
                <Link href="/dashboard/puzzles">Puzzle trainer</Link>
                <Link href="/dashboard/settings">User settings</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
