import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm text-slate-600">
          Placeholder login screen for NextAuth and credential or OAuth providers.
        </p>
        <div className="mt-6">
          <Button href="/dashboard">Continue to dashboard</Button>
        </div>
      </section>
    </main>
  );
}
