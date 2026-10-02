import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewerProvider } from "@/context/Viewer";
import { visibleNavItems } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";

const accountLinkClass =
  "rounded-2xl px-3 py-2 text-left text-sm text-[var(--bg-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white";

async function signOutAction() {
  "use server";

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/dashboard");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-3 px-3 py-3 lg:grid-cols-[200px_1fr]">
        <aside className="flex flex-col rounded-[2rem] bg-[var(--bg-sidebar)] px-4 py-5 text-[var(--bg-sidebar-text)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--bg-sidebar-muted)]">
            ByTheBook
          </p>
          <h2 className="mt-2 text-xl font-semibold">Dashboard</h2>
          <nav className="mt-6 grid gap-1">
            {visibleNavItems(viewer.signedIn).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2.5 text-sm text-[var(--bg-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Account block */}
          <div className="mt-6 grid gap-1 border-t border-white/10 pt-4 lg:mt-auto">
            {viewer.signedIn ? (
              <>
                <p className="truncate px-3 text-xs text-[var(--bg-sidebar-muted)]">
                  Signed in as{" "}
                  <span className="text-[var(--bg-sidebar-text)]">{viewer.displayName}</span>
                </p>
                <form action={signOutAction} className="grid">
                  <button className={accountLinkClass} type="submit">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="px-3 text-xs text-[var(--bg-sidebar-muted)]">Browsing as a guest</p>
                <Link className={accountLinkClass} href="/auth/login">
                  Sign in
                </Link>
                <Link className={accountLinkClass} href="/auth/register">
                  Create account
                </Link>
                {betaKeyMailto ? (
                  // The address is written out because a mailto link does nothing for a
                  // visitor with no mail program set up; they can copy it instead.
                  <>
                    <a className={accountLinkClass} href={betaKeyMailto}>
                      Request a beta key
                    </a>
                    <p className="px-3 text-xs text-[var(--bg-sidebar-muted)]">
                      Email{" "}
                      <span className="select-all break-all text-[var(--bg-sidebar-text)]">
                        {betaContactEmail}
                      </span>
                    </p>
                  </>
                ) : null}
              </>
            )}
          </div>
        </aside>
        <div className="rounded-[2rem] border border-[var(--border-card)] bg-[var(--bg-card)] p-4 shadow-sm">
          <ViewerProvider signedIn={viewer.signedIn}>{children}</ViewerProvider>
        </div>
      </div>
    </div>
  );
}
