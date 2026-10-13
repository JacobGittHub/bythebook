import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";
import { credentialsInputSchema } from "@/lib/validators/schemas";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const { next, error, notice } = await searchParams;

  // A returning user whose session is still good has nothing to do here.
  if ((await getViewer()).signedIn) {
    redirect("/dashboard");
  }

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
    <>
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">ByTheBook</p>
      <h1 className="mt-1 font-heading text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with the email and password of your beta account.
      </p>
      {notice === "password_reset" ? (
        <Alert variant="success" className="mt-3">
          <AlertDescription>Your password was changed. Sign in with the new one.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            {error === "invalid_credentials"
              ? "Enter a valid email and a password with at least 8 characters."
              : "Unable to sign in with those credentials."}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={loginAction} className="mt-4 grid gap-3">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input
            name="email"
            placeholder="you@example.com"
            type="email"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <Input
            name="password"
            placeholder="At least 8 characters"
            type="password"
          />
        </label>
        <Button className="justify-self-start" type="submit">
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        <Link className="font-medium text-foreground underline" href="/auth/reset">
          Forgot your password?
        </Link>{" "}
        ·{" "}
        <Link className="font-medium text-foreground underline" href="/auth/register">
          Create an account
        </Link>{" "}
        ·{" "}
        <Link className="font-medium text-foreground underline" href="/dashboard">
          Continue as a guest
        </Link>
      </p>
    </>
  );
}
