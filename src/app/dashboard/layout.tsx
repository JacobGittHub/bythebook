import { cookies } from "next/headers";
import { BookFrame } from "@/components/book/BookFrame";
import { BrowserBooksNotice } from "@/components/repertoire/BrowserBooksOffer";
import { Toaster } from "@/components/shadcn/sonner";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { BugReportProvider } from "@/context/BugReport";
import { LibraryProvider } from "@/context/Library";
import { ViewerProvider } from "@/context/Viewer";
import { bookContents, visibleNavItems } from "@/lib/auth/access";
import { canDebug } from "@/lib/auth/debug";
import { getViewer } from "@/lib/auth/viewer";
import { CHAPTERS_COOKIE, FORM_COOKIE } from "@/lib/book/frameCss";
import { signOutAction } from "./actions";

/** The dashboard: the book on its desk (plans/book-ui.md), with a page of it for each route. */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  const debug = canDebug(viewer);
  const contents = bookContents(viewer.signedIn);
  const chapters = visibleNavItems(viewer.signedIn).map(({ href, label, icon, status }) => {
    const index = contents.findIndex((entry) => entry.href === href);
    return { href, label, icon, number: index < 0 ? null : index + 1, soon: status === "coming_soon" };
  });
  const cookieStore = await cookies();
  const initialForm = cookieStore.get(FORM_COOKIE)?.value === "single" ? "single" : "spread";
  const column = cookieStore.get(CHAPTERS_COOKIE)?.value;
  const initialColumn = column === "names" || column === "icons" ? column : null;

  return (
    // The bug report provider wraps the frame too, so its button can read the page.
    <BugReportProvider>
      <ViewerProvider signedIn={viewer.signedIn} debug={debug}>
        <LibraryProvider>
          <TooltipProvider delayDuration={300}>
            <BookFrame
              chapters={chapters}
              chapterCount={contents.length}
              initialForm={initialForm}
              initialColumn={initialColumn}
              viewer={{ signedIn: viewer.signedIn, displayName: viewer.signedIn ? viewer.displayName : null }}
              debug={debug}
              signOut={signOutAction}
            >
              {children}
            </BookFrame>
            <BrowserBooksNotice />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </LibraryProvider>
      </ViewerProvider>
    </BugReportProvider>
  );
}
