import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { resetPasswordWithCode } from "@/lib/auth/accounts";
import { betaContactEmail, resetRequestMailto } from "@/lib/auth/contact";
import { resetPasswordInputSchema } from "@/lib/validators/schemas";

const errorMessages: Record<string, string> = {
  invalid_reset: "Enter your reset code and a new password with at least 8 characters.",
  invalid_code: "That reset code isn't valid, or it has already been used.",
  password_mismatch: "The two passwords don't match.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function resetAction(formData: FormData) {
    "use server";

    if (
      String(formData.get("password") ?? "") !== String(formData.get("confirmPassword") ?? "")
    ) {
      redirect("/auth/reset?error=password_mismatch");
    }

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
    <>
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">ByTheBook</p>
      <h1 className="mt-1 font-heading text-2xl font-semibold">Reset password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        During the beta, passwords are reset with a one-time code. Request one by email,
        then choose a new password here.
      </p>
      {resetRequestMailto ? (
        // The address is written out because a mailto link does nothing for a visitor
        // with no mail program set up; they can copy it instead.
        <div className="mt-3 grid justify-items-start gap-2">
          <Button asChild variant="outline">
            <a href={resetRequestMailto}>Email for a reset code</a>
          </Button>
          <p className="text-sm text-muted-foreground">
            Or write to{" "}
            <a className="font-medium text-foreground underline" href={resetRequestMailto}>
              {betaContactEmail}
            </a>
            . So the code works for your account, send the request from the email address
            tied to it.
          </p>
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            {errorMessages[error] ?? "Unable to set a new password right now. Try again."}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={resetAction} className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Reset code</span>
          <Input
            autoComplete="off"
            className="font-mono uppercase placeholder:normal-case"
            name="code"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            type="text"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">New password</span>
          <Input
            autoComplete="new-password"
           
            name="password"
            placeholder="At least 8 characters"
            type="password"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Confirm new password</span>
          <Input
            autoComplete="new-password"
           
            name="confirmPassword"
            placeholder="Re-enter your new password"
            type="password"
          />
        </label>
        <Button className="justify-self-start" type="submit">
          Set new password
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link className="font-medium text-foreground underline" href="/auth/login">
          Sign in
        </Link>
      </p>
    </>
  );
}
