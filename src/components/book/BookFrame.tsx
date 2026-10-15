"use client";

import {
  BookOpen,
  Compass,
  Eye,
  House,
  LogIn,
  LogOut,
  Puzzle,
  SlidersHorizontal,
  Store,
  Target,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { BugReportButton } from "@/components/layout/BugReportButton";
import { Button } from "@/components/shadcn/button";
import { Switch } from "@/components/shadcn/switch";
import { useAppearance } from "@/context/Appearance";
import type { ChapterIcon } from "@/lib/auth/access";
import { chapterAt } from "@/lib/book/chapters";
import { FORM_COOKIE, SPREAD_QUERY, bookFrameCss } from "@/lib/book/frameCss";
import type { BookForm, Size, Span } from "@/lib/book/layout";
import { cn } from "@/lib/utils";

// The book frame (plans/book-ui.md D1, D12, D15): the desk, with the strip above it (the
// spread) or the chapter column beside it (the one-page form). The pages are the route's: each
// renders its book on the desk (Spread.tsx), so a page says what its two pages hold and how far
// its book slides. The frame tells the pages where they are in the book, and where the strip's
// tabs are, for their bookmarks.

export type Chapter = { href: string; label: string; icon: ChapterIcon };

const ICONS: Record<ChapterIcon, LucideIcon> = {
  house: House,
  compass: Compass,
  eye: Eye,
  book: BookOpen,
  store: Store,
  target: Target,
  puzzle: Puzzle,
  sliders: SlidersHorizontal,
};

type BookFrameContext = {
  form: BookForm;
  chapters: Chapter[];
  /** The current page's chapter, or -1 outside every chapter. */
  at: number;
  /** The window, and the strip's tabs as measured; null until the browser has them. */
  window: Size | null;
  tabs: Span[] | null;
};

const FrameContext = createContext<BookFrameContext>({
  form: "spread",
  chapters: [],
  at: -1,
  window: null,
  tabs: null,
});

export const useBookFrame = () => useContext(FrameContext);

const subscribeForm = (onChange: () => void) => {
  const query = window.matchMedia(SPREAD_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const readForm = (): BookForm => (window.matchMedia(SPREAD_QUERY).matches ? "spread" : "single");

// The window's size, kept as one object while it doesn't change, as useSyncExternalStore needs.
let windowSize: Size | null = null;
const subscribeWindow = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const readWindow = (): Size => {
  const { innerWidth: width, innerHeight: height } = window;
  if (windowSize?.width !== width || windowSize.height !== height) windowSize = { width, height };
  return windowSize;
};

export function BookFrame({
  chapters,
  initialForm,
  viewer,
  debug,
  signOut,
  children,
}: {
  /** The book's chapters for this viewer, in book order (`visibleNavItems`). */
  chapters: Chapter[];
  /** The form to render on the server, from `FORM_COOKIE`. */
  initialForm: BookForm;
  viewer: { signedIn: boolean; displayName: string | null };
  debug: boolean;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const form = useSyncExternalStore(subscribeForm, readForm, () => initialForm);
  const size = useSyncExternalStore(subscribeWindow, readWindow, () => null);
  const at = chapterAt(pathname, chapters.map((c) => c.href));
  const [tabs, setTabs] = useState<Span[] | null>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    document.cookie = `${FORM_COOKIE}=${form}; path=/; max-age=31536000; samesite=lax`;
  }, [form]);

  const measure = useCallback(() => {
    if (form !== "spread") return setTabs(null);
    setTabs(
      chapters.map((_, i) => {
        const rect = tabRefs.current[i]?.getBoundingClientRect();
        return rect ? { x: rect.left, width: rect.width } : { x: 0, width: 0 };
      }),
    );
  }, [chapters, form]);

  // The tabs move when the fonts arrive, the current tab turns bold, or the window changes. A
  // ResizeObserver reports each tab once as it starts, which takes the first measure.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure);
    tabRefs.current.forEach((el) => el && observer.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, at]);

  const account = <AccountLinks viewer={viewer} debug={debug} signOut={signOut} form={form} />;

  return (
    <FrameContext.Provider value={{ form, chapters, at, window: size, tabs }}>
      <style href="book-frame" precedence="default">
        {bookFrameCss()}
      </style>
      <div className="book-frame" data-form={form}>
        {form === "spread" ? (
          <header className="book-strip">
            <Brand />
            <nav aria-label="Chapters" className="ml-2 flex items-center text-[13px] text-muted-foreground">
              {chapters.map((chapter, i) => (
                <Link
                  key={chapter.href}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  href={chapter.href}
                  aria-current={i === at ? "page" : undefined}
                  className={cn(
                    "px-2 py-[7px] hover:text-foreground",
                    i === at && "font-bold text-foreground shadow-[inset_0_-2px_0_var(--bookmark)]",
                  )}
                >
                  {chapter.label}
                </Link>
              ))}
            </nav>
            <span className="grow" />
            {account}
          </header>
        ) : (
          <nav aria-label="Chapters" className="book-chapters">
            <div className="book-chapters-head">
              <Brand />
            </div>
            <div className="book-chapter-list">
              {chapters.map((chapter, i) => {
                const Icon = ICONS[chapter.icon];
                return (
                  <Link
                    key={chapter.href}
                    href={chapter.href}
                    aria-current={i === at ? "page" : undefined}
                    aria-label={chapter.label}
                    title={chapter.label}
                    className={cn(
                      "book-chapter text-[13px] text-muted-foreground hover:text-foreground",
                      i === at && "font-bold text-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-4 flex-none" />
                    <span className="book-chapter-text">{chapter.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="book-chapters-foot text-[13px] text-muted-foreground">{account}</div>
          </nav>
        )}
        <div className="book-desk">{children}</div>
      </div>
    </FrameContext.Provider>
  );
}

/** The brand; in the narrow chapter column, its first letter. */
function Brand() {
  return (
    <span className="font-heading text-[19px] leading-[30px] font-semibold tracking-[-0.01em]">
      B<span className="book-chapter-text">yTheBook</span>
    </span>
  );
}

/**
 * The vibes switch (D12), the bug report in debug mode, and the account links: in a row in the
 * strip, or down the foot of the chapter column, where a narrow column shows only their icons.
 */
function AccountLinks({
  viewer,
  debug,
  signOut,
  form,
}: {
  viewer: { signedIn: boolean; displayName: string | null };
  debug: boolean;
  signOut: () => Promise<void>;
  form: BookForm;
}) {
  const { vibes, setVibes } = useAppearance();
  const strip = form === "spread";
  const text = (label: string) => <span className="book-chapter-text">{label}</span>;

  const vibesSwitch = (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-foreground" title="Vibes dress the book">
      <Switch checked={vibes} onCheckedChange={setVibes} aria-label="Vibes" />
      {text("Vibes")}
    </label>
  );

  if (strip) {
    return (
      <div className="flex items-center gap-2.5">
        {vibesSwitch}
        {debug && (
          <BugReportButton
            signedIn={viewer.signedIn}
            icon
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            textClassName="sr-only"
          />
        )}
        {viewer.signedIn ? (
          <>
            <span className="max-w-48 truncate text-xs text-muted-foreground max-[1279px]:hidden">
              Signed in as <span className="text-foreground">{viewer.displayName}</span>
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground max-[1279px]:hidden">Browsing as a guest</span>
            <Button asChild variant="ghost" size="sm" className="font-bold">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/register">Create account</Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  const row = "hover:text-foreground";
  return (
    <>
      {vibesSwitch}
      {debug && <BugReportButton signedIn={viewer.signedIn} icon className={row} textClassName="book-chapter-text" />}
      {viewer.signedIn ? (
        <>
          <span className="book-chapter-text truncate text-xs">
            Signed in as <span className="text-foreground">{viewer.displayName}</span>
          </span>
          <form action={signOut}>
            <button type="submit" className={cn(row, "flex items-center gap-[9px]")} aria-label="Sign out" title="Sign out">
              <LogOut aria-hidden className="size-4 flex-none" />
              {text("Sign out")}
            </button>
          </form>
        </>
      ) : (
        <>
          <span className="book-chapter-text text-xs">Browsing as a guest</span>
          <Link href="/auth/login" className={cn(row, "font-bold text-foreground")} aria-label="Sign in" title="Sign in">
            <LogIn aria-hidden className="size-4 flex-none" />
            {text("Sign in")}
          </Link>
          <Link href="/auth/register" className={row} aria-label="Create account" title="Create account">
            <UserPlus aria-hidden className="size-4 flex-none" />
            {text("Create account")}
          </Link>
        </>
      )}
    </>
  );
}
