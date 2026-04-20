import { redirect } from "next/navigation";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase";
import { registerInputSchema } from "@/lib/validators/schemas";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function registerAction(formData: FormData) {
    "use server";

    const username = String(formData.get("username") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const parsedRegistration = registerInputSchema.safeParse({
      username,
      email,
      password,
    });

    if (!parsedRegistration.success) {
      redirect("/auth/register?error=invalid_registration");
    }

    const supabase = await createServerSupabaseClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsedRegistration.data.email,
      password: parsedRegistration.data.password,
      options: {
        data: {
          username: parsedRegistration.data.username,
        },
      },
    });

    if (signUpError || !data.user) {
      redirect("/auth/register?error=sign_up_failed");
    }

    const adminSupabase = createAdminSupabaseClient();
    await adminSupabase.from("profiles").upsert({
      id: data.user.id,
      username: parsedRegistration.data.username,
      updated_at: new Date().toISOString(),
    });

    if (data.session) {
      redirect("/dashboard");
    }

    redirect("/auth/login?next=/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Create account
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Create an account with Supabase Auth. Your profile username is stored in
          the app database.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error === "invalid_registration"
              ? "Enter a username, a valid email, and a password with at least 8 characters."
              : "Unable to create your account right now."}
          </p>
        ) : null}
        <form action={registerAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Username</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
              name="username"
              placeholder="chesshandle"
              type="text"
            />
          </label>
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
            Create account
          </button>
        </form>
      </section>
    </main>
  );
}
