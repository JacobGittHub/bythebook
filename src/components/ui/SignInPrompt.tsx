import Link from "next/link";

const linkClass = "font-medium text-[var(--text-primary)] underline";

/** Shown to a guest in place of something that needs an account, such as saving a book. */
export function SignInPrompt({
  action,
  className = "text-sm",
}: {
  /** Completes "Sign in or create an account to …". */
  action: string;
  className?: string;
}) {
  return (
    <p className={`text-[var(--text-muted)] ${className}`}>
      <Link className={linkClass} href="/auth/login">
        Sign in
      </Link>{" "}
      or{" "}
      <Link className={linkClass} href="/auth/register">
        create an account
      </Link>{" "}
      to {action}.
    </p>
  );
}
