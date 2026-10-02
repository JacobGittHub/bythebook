import { RouteCard } from "@/components/ui/RouteCard";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { VISUALIZATIONS, type PageLink } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";

const sectionHeadingClass =
  "mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]";

export default async function VisualizationsPage() {
  const viewer = await getViewer();
  const live = VISUALIZATIONS.filter((page) => page.status === "live");
  const prototypes = VISUALIZATIONS.filter((page) => page.status === "prototype");

  // A guest sees an account-only visualization listed, but not as a button.
  const card = (page: PageLink) => {
    const locked = page.access === "account" && !viewer.signedIn;
    return (
      <RouteCard
        key={page.href}
        href={locked ? undefined : page.href}
        label={page.label}
        summary={page.summary}
        status={page.status}
        note={locked ? <SignInPrompt action="open this prototype" className="text-xs" /> : null}
      />
    );
  };

  return (
    <main className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[var(--text-primary)]">Visualizations</h1>
          <span className="rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            Experimental
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
          Different ways to see opening theory as a place you can move around in. These are
          experiments: they change often, and some may be replaced.
        </p>
      </div>

      <section>
        <h2 className={sectionHeadingClass}>Available now</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{live.map(card)}</div>
      </section>

      <section>
        <h2 className={sectionHeadingClass}>Possible future visualizations</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{prototypes.map(card)}</div>
      </section>
    </main>
  );
}
