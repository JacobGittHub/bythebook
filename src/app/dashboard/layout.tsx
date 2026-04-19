import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/train", label: "Train" },
  { href: "/dashboard/repertoire", label: "Repertoire" },
  { href: "/dashboard/puzzles", label: "Puzzles" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[2rem] bg-slate-950 p-6 text-slate-100">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            ByTheBook
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Dashboard</h2>
          <nav className="mt-8 grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
