import Link from "next/link";
import { redirect } from "next/navigation";
import { resetPasswordWithCode } from "@/lib/auth/accounts";
import { resetPasswordInputSchema } from "@/lib/validators/schemas";

const errorMessages: Record<string, string> = {
  invalid_reset: "Enter your reset code and a new password with at least 8 characters.",
  invalid_code: "That reset code isn't valid, or it has already been used.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function resetAction(formData: FormData) {
    "use server";

    const parsedReset = resetPasswordInputSchema.safeParse({
      code: String(formData.get("code") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (!parsedReset.success) {
      redirect("/auth/reset?error=invalid_reset");
    }

    const outcome = await resetPasswordWithCode(parsedReset.data);

    if (outcome !== "ok") {
      redirect(`/auth/reset?error=${outcome === "bad_code" ? "invalid_code" : "reset_failed"}`);
    }

    redirect("/auth/login?notice=password_reset");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Reset password</h1>
        <p className="mt-3 text-sm text-slate-600">
          During the beta, passwords are reset with a one-time code. Ask the person who
          invited you for a reset code, then choose a new password here.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessages[error] ?? "Unable to set a new password right now. Try again."}
          </p>
        ) : null}
        <form action={resetAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Reset code</span>
            <input
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono uppercase text-slate-900 outline-none transition-colors placeholder:normal-case focus:border-slate-950"
              name="code"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              type="text"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input
              autoComplete="new-password"
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
            Set new password
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          Remembered it?{" "}
          <Link className="font-medium text-slate-950 underline" href="/auth/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
