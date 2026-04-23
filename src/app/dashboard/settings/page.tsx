import { AppearancePanel } from "@/components/settings/AppearancePanel";

export default function SettingsPage() {
  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          User profile, board preferences, engine defaults, and notification
          options.
        </p>
      </div>

      {/* Appearance */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Appearance
        </h2>
        <div className="rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-6">
          <h3 className="font-semibold text-[var(--text-primary)]">
            Background style
          </h3>
          <p className="mb-6 mt-1 text-sm text-[var(--text-muted)]">
            Choose a background across all pages. Board colors are set
            separately.
          </p>
          <AppearancePanel />
        </div>
      </section>

      {/* Board & play */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Board &amp; play
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-5">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Board preferences
            </h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Coordinates, move highlights, and flip behavior.
            </p>
          </article>
          <article className="rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-5">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Account
            </h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Profile details, export settings, and linked auth providers.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
