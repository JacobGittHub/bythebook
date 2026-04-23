import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/explorer", label: "Explorer" },
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
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-3 px-3 py-3 lg:grid-cols-[200px_1fr]">
        <aside className="rounded-[2rem] bg-[var(--bg-sidebar)] px-4 py-5 text-[var(--bg-sidebar-text)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--bg-sidebar-muted)]">
            ByTheBook
          </p>
          <h2 className="mt-2 text-xl font-semibold">Dashboard</h2>
          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2.5 text-sm text-[var(--bg-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="rounded-[2rem] border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
