import Link from "next/link";
import { redirect } from "next/navigation";
import { BugReportButton } from "@/components/layout/BugReportButton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BugReportProvider } from "@/context/BugReport";
import { LibraryProvider } from "@/context/Library";
import { ViewerProvider } from "@/context/Viewer";
import { visibleNavItems } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { canDebug } from "@/lib/auth/debug";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";

const linkClass =
  "rounded-2xl px-3 py-2.5 text-left text-sm text-[var(--bg-sidebar-text)] transition-colors hover:bg-white/10";

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

  const sidebar = (
    <>
      <nav className="mt-6 grid gap-1">
        {visibleNavItems(viewer.signedIn).map((item) => (
          <Link key={item.href} href={item.href} className={linkClass}>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Account block */}
      <div className="mt-auto grid gap-1 pt-6">
        {canDebug(viewer) && <BugReportButton signedIn={viewer.signedIn} className={linkClass} />}
        <div className="grid gap-1 border-t border-white/10 pt-4">
          {viewer.signedIn ? (
            <>
              <p className="truncate px-3 text-xs text-[var(--bg-sidebar-muted)]">
                Signed in as{" "}
                <span className="text-[var(--bg-sidebar-text)]">{viewer.displayName}</span>
              </p>
              <form action={signOutAction} className="grid">
                <button className={linkClass} type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="px-3 text-xs text-[var(--bg-sidebar-muted)]">Browsing as a guest</p>
              <Link className={linkClass} href="/auth/login">
                Sign in
              </Link>
              <Link className={linkClass} href="/auth/register">
                Create account
              </Link>
              {betaKeyMailto ? (
                // The address is the link's own text, so a visitor whose mailto link does
                // nothing can still read and copy it.
                <div className="mt-2 rounded-2xl border border-white/15 px-3 py-2.5 text-xs text-[var(--bg-sidebar-muted)]">
                  <p className="font-medium text-[var(--bg-sidebar-text)]">Need a beta key?</p>
                  <p className="mt-1">Send an email asking for one to:</p>
                  <a
                    className="mt-1 block break-all text-[var(--bg-sidebar-text)] underline"
                    href={betaKeyMailto}
                  >
                    {betaContactEmail}
                  </a>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    // The bug report provider wraps the sidebar too, so its button can read the page.
    <BugReportProvider>
      <DashboardShell sidebar={sidebar}>
        <ViewerProvider signedIn={viewer.signedIn}>
          <LibraryProvider>{children}</LibraryProvider>
        </ViewerProvider>
      </DashboardShell>
    </BugReportProvider>
  );
}
