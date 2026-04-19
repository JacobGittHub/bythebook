export default function SettingsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Settings</h1>
        <p className="mt-2 text-slate-600">
          User profile, board preferences, engine defaults, and notification options.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-900">Board preferences</h2>
          <p className="mt-2 text-sm text-slate-600">
            Theme, coordinates, move highlights, and flip behavior.
          </p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-900">Account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Profile details, export settings, and linked auth providers.
          </p>
        </article>
      </section>
    </main>
  );
}
