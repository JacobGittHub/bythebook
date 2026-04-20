import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { credentialsInputSchema } from "@/lib/validators/schemas";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function loginAction(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const redirectTo = String(formData.get("next") ?? "/dashboard");
    const parsedCredentials = credentialsInputSchema.safeParse({
      email,
      password,
    });

    if (!parsedCredentials.success) {
      redirect(`/auth/login?error=invalid_credentials&next=${encodeURIComponent(redirectTo)}`);
    }

    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(
      parsedCredentials.data,
    );

    if (signInError) {
      redirect(`/auth/login?error=sign_in_failed&next=${encodeURIComponent(redirectTo)}`);
    }

    redirect(redirectTo);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in with your Supabase Auth email and password.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error === "invalid_credentials"
              ? "Enter a valid email and a password with at least 8 characters."
              : "Unable to sign in with those credentials."}
          </p>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
              name="password"
              placeholder="At least 8 characters"
              type="password"
            />
          </label>
          <button
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
