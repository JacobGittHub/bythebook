import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { registerWithInvite } from "@/lib/auth/accounts";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";
import { registerInputSchema } from "@/lib/validators/schemas";

const errorMessages: Record<string, string> = {
  invalid_registration:
    "Enter an invite code, a username of 3 to 24 letters, digits, \"_\" or \"-\", a valid email, and a password with at least 8 characters.",
  username_taken: "That username is taken. Usernames ignore case, so try another one.",
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
      const reason =
        outcome === "bad_code" ? "invalid_code" : outcome === "username_taken" ? "username_taken" : "sign_up_failed";
      redirect(`/auth/register?error=${reason}`);
    }

    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsedRegistration.data.email,
      password: parsedRegistration.data.password,
    });

    redirect(signInError ? "/auth/login?next=/dashboard" : "/dashboard");
  }

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">ByTheBook</p>
      <h1 className="mt-1 font-heading text-2xl font-semibold">
        Create account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ByTheBook is in beta, so creating an account needs an invite code. Each code
        works once.
        {betaKeyMailto ? (
          // The address is written out because a mailto link does nothing for a visitor
          // with no mail program set up; they can copy it instead.
          <>
            {" "}
            To ask for one, email{" "}
            <a className="font-medium text-foreground underline" href={betaKeyMailto}>
              {betaContactEmail}
            </a>
            .
          </>
        ) : null}
      </p>
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            {errorMessages[error] ??
              "Unable to create your account right now. If you already have one, sign in instead."}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={registerAction} className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Invite code</span>
          <Input
            autoComplete="off"
            className="font-mono uppercase placeholder:normal-case"
            name="code"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            type="text"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Username</span>
          <Input
            maxLength={24}
            name="username"
            pattern="[A-Za-z0-9_-]{3,24}"
            placeholder="chesshandle"
            title="3 to 24 letters, digits, _ or -"
            type="text"
          />
          <span className="text-xs text-muted-foreground">
            Shown to other players later, so not your email: 3 to 24 letters, digits, _ or -.
          </span>
        </label>
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
            autoComplete="new-password"
           
            name="password"
            placeholder="At least 8 characters"
            type="password"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Confirm password</span>
          <Input
            autoComplete="new-password"
           
            name="confirmPassword"
            placeholder="Re-enter your password"
            type="password"
          />
        </label>
        <Button className="justify-self-start" type="submit">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-foreground underline" href="/auth/login">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link className="font-medium text-foreground underline" href="/dashboard">
          Continue as a guest
        </Link>
      </p>
    </>
  );
}
