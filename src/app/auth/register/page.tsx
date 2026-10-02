import Link from "next/link";
import { redirect } from "next/navigation";
import { registerWithInvite } from "@/lib/auth/accounts";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";
import { registerInputSchema } from "@/lib/validators/schemas";

const errorMessages: Record<string, string> = {
  invalid_registration:
    "Enter an invite code, a username, a valid email, and a password with at least 8 characters.",
  invalid_code: "That invite code isn't valid, or it has already been used.",
  password_mismatch: "The two passwords don't match.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if ((await getViewer()).signedIn) {
    redirect("/dashboard");
  }

  async function registerAction(formData: FormData) {
    "use server";

    if (
      String(formData.get("password") ?? "") !== String(formData.get("confirmPassword") ?? "")
    ) {
      redirect("/auth/register?error=password_mismatch");
    }

    const parsedRegistration = registerInputSchema.safeParse({
      code: String(formData.get("code") ?? ""),
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (!parsedRegistration.success) {
      redirect("/auth/register?error=invalid_registration");
    }

    const outcome = await registerWithInvite(parsedRegistration.data);

    if (outcome !== "ok") {
      redirect(
        `/auth/register?error=${outcome === "bad_code" ? "invalid_code" : "sign_up_failed"}`,
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsedRegistration.data.email,
      password: parsedRegistration.data.password,
    });

    redirect(signInError ? "/auth/login?next=/dashboard" : "/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Create account
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          ByTheBook is in beta, so creating an account needs an invite code. Each code
          works once.
          {betaKeyMailto ? (
            // The address is written out because a mailto link does nothing for a visitor
            // with no mail program set up; they can copy it instead.
            <>
              {" "}
              To ask for one, email{" "}
              <a className="font-medium text-slate-950 underline" href={betaKeyMailto}>
                {betaContactEmail}
              </a>
              .
            </>
          ) : null}
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessages[error] ??
              "Unable to create your account right now. If you already have one, sign in instead."}
          </p>
        ) : null}
        <form action={registerAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Invite code</span>
            <input
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono uppercase text-slate-900 outline-none transition-colors placeholder:normal-case focus:border-slate-950"
              name="code"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              type="text"
            />
          </label>
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
              autoComplete="new-password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
              name="password"
              placeholder="At least 8 characters"
              type="password"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Confirm password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-950"
              name="confirmPassword"
              placeholder="Re-enter your password"
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
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-medium text-slate-950 underline" href="/auth/login">
            Sign in
          </Link>{" "}
          ·{" "}
          <Link className="font-medium text-slate-950 underline" href="/dashboard">
            Continue as a guest
          </Link>
        </p>
      </section>
    </main>
  );
}
