import { signIn, isDevelopmentCredentialsEnabled } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const developmentCredentialsEnabled = isDevelopmentCredentialsEnabled();

  async function loginAction(formData: FormData) {
    "use server";

    const username = String(formData.get("username") ?? "");
    const redirectTo = String(formData.get("next") ?? "/dashboard");

    await signIn("credentials", {
      username,
      redirectTo,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm text-slate-600">
          {developmentCredentialsEnabled
            ? "Development credentials are enabled. Sign in with an existing profile username."
            : "Authentication providers are not configured yet. Add a real NextAuth provider before deploying."}
        </p>
        {developmentCredentialsEnabled ? (
          <form action={loginAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Username</span>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
                name="username"
                placeholder="profile username"
                type="text"
              />
            </label>
            <button
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              type="submit"
            >
              Sign in
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
