import Link from "next/link";
import { redirect } from "next/navigation";
import { BugReportButton } from "@/components/layout/BugReportButton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BrowserBooksNotice } from "@/components/repertoire/BrowserBooksOffer";
import { Toaster } from "@/components/shadcn/sonner";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { BugReportProvider } from "@/context/BugReport";
import { LibraryProvider } from "@/context/Library";
import { ViewerProvider } from "@/context/Viewer";
import { visibleNavItems } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { canDebug } from "@/lib/auth/debug";
import { getViewer } from "@/lib/auth/viewer";
import { createServerSupabaseClient } from "@/lib/supabase";

const linkClass =
  "rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent";

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
  const debug = canDebug(viewer);

  const sidebar = (
    <>
      <nav className="mt-4 grid gap-0.5">
        {visibleNavItems(viewer.signedIn).map((item) => (
          <Link key={item.href} href={item.href} className={linkClass}>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Account block */}
      <div className="mt-auto grid gap-0.5 pt-4">
        {debug && <BugReportButton signedIn={viewer.signedIn} className={linkClass} />}
        <div className="grid gap-0.5 border-t border-sidebar-border pt-3">
          {viewer.signedIn ? (
            <>
              <p className="truncate px-2 text-xs text-sidebar-muted-foreground">
                Signed in as{" "}
                <span className="text-sidebar-foreground">{viewer.displayName}</span>
              </p>
              <form action={signOutAction} className="grid">
                <button className={linkClass} type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="px-2 text-xs text-sidebar-muted-foreground">Browsing as a guest</p>
              <Link className={linkClass} href="/auth/login">
                Sign in
              </Link>
              <Link className={linkClass} href="/auth/register">
                Create account
              </Link>
              {betaKeyMailto ? (
                // The address is the link's own text, so a visitor whose mailto link does
                // nothing can still read and copy it.
                <div className="mt-2 rounded-md border border-sidebar-border px-2 py-2 text-xs text-sidebar-muted-foreground">
                  <p className="font-medium text-sidebar-foreground">Need a beta key?</p>
                  <p className="mt-1">Send an email asking for one to:</p>
                  <a
                    className="mt-1 block break-all text-sidebar-foreground underline"
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
        <ViewerProvider signedIn={viewer.signedIn} debug={debug}>
          <LibraryProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <BrowserBooksNotice />
              <Toaster position="bottom-right" />
            </TooltipProvider>
          </LibraryProvider>
        </ViewerProvider>
      </DashboardShell>
    </BugReportProvider>
  );
}
