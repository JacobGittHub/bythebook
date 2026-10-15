"use client";

import {
  BookOpen,
  Compass,
  Eye,
  House,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
  ViewTransition,
  type ReactNode,
} from "react";
import { Book, type BookCamera } from "@/components/book/Book";
import { moveWithCamera, type CameraMove } from "@/components/book/camera";
import { BugReportButton } from "@/components/layout/BugReportButton";
import { Button } from "@/components/shadcn/button";
import { Switch } from "@/components/shadcn/switch";
import { useAppearance } from "@/context/Appearance";
import type { ChapterIcon } from "@/lib/auth/access";
import { NO_CAMERA, cameraTransform, shownHeight, zoomCamera, type Camera } from "@/lib/book/camera";
import { bookOrder, chapterAt, levelAt, type Level } from "@/lib/book/chapters";
import { CHAPTERS_COOKIE, FORM_COOKIE, SPREAD_QUERY, bookFrameCss } from "@/lib/book/frameCss";
import {
  chaptersFor,
  layoutBook,
  type BookForm,
  type ChapterColumn,
  type Size,
  type Span,
  type SpreadLayout,
} from "@/lib/book/layout";
import { moveBetween, moveTiming, type Place, type TurnWay, type Zoom } from "@/lib/book/turns";
import type { Motion } from "@/lib/appearance";
import { cn } from "@/lib/utils";
import "./turns.css";

// The book frame (plans/book-ui.md D1, D8, D12, D15): the desk, with the strip above it (the
// spread) or the chapter column beside it (the one-page form), and the book on it. The pages
// are the route's: each renders its pages into the book (Spread.tsx), so a page says what its
// two pages hold. The frame tells the pages where they are in the book, at which level, and
// where the strip's tabs are, for their bookmarks. A page below a chapter's own page is its
// second level, which the spread's camera zooms in on (src/lib/book/camera.ts).
//
// A move to another page turns it (D8, D13, D14). Each page is a named view transition
// (Spread.tsx), so the page leaving and the page arriving are pictures the browser animates
// (turns.css). React gives a view transition its enter and exit only when no element of the
// page's own lies above it, so the book, which holds the pages, is the frame's. The frame
// works out which way the book turns from the place it was at, and writes it to <html> as
// `data-turn`, with the camera's move as `data-zoom`: a leaving page last rendered before the
// move, so its classes can't say the way. As each picture of the turn appears, the page tells
// the frame (`onPicture`), which moves it with the camera (camera.ts).

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

/** The last move between pages: which way the book turned, which chapters riffled past, and how the camera moved. */
export type FrameTurn = {
  /** Counts the moves, so each turn's riffled leaves are new ones. */
  id: number;
  way: TurnWay | null;
  riffled: number[];
  zoom: Zoom | null;
  camera: CameraMove | null;
};

/** A picture of the turn the browser has taken: of the page that leaves (`old`) or the one that arrives (`new`). */
export type PictureTaken = "old" | "new";

type BookFrameContext = {
  form: BookForm;
  motion: Motion;
  turn: FrameTurn;
  chapters: Chapter[];
  /** The current page's chapter, or -1 outside every chapter, and its level there (D8). */
  at: number;
  level: Level;
  /** The one-page form's chapter column: the reader's pick, or the window's default (a phone shows icons whatever it says). */
  column: ChapterColumn;
  /** The window, and the strip's tabs as measured; null until the browser has them. */
  window: Size | null;
  tabs: Span[] | null;
  /** Moves the turn's picture `name` with the camera; returns what stops it. */
  onPicture: (name: string, taken: PictureTaken) => (() => void) | undefined;
};

const NO_TURN: FrameTurn = { id: 0, way: null, riffled: [], zoom: null, camera: null };

const FrameContext = createContext<BookFrameContext>({
  form: "spread",
  motion: "turn",
  turn: NO_TURN,
  chapters: [],
  at: -1,
  level: 1,
  column: "names",
  window: null,
  tabs: null,
  onPicture: () => undefined,
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
  initialColumn,
  viewer,
  debug,
  signOut,
  children,
}: {
  /** The book's chapters for this viewer, in book order (`visibleNavItems`). */
  chapters: Chapter[];
  /** The form to render on the server, from `FORM_COOKIE`. */
  initialForm: BookForm;
  /** The reader's pick of the chapter column, from `CHAPTERS_COOKIE`, or null to follow the window. */
  initialColumn: ChapterColumn | null;
  viewer: { signedIn: boolean; displayName: string | null };
  debug: boolean;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const form = useSyncExternalStore(subscribeForm, readForm, () => initialForm);
  const size = useSyncExternalStore(subscribeWindow, readWindow, () => null);
  const at = chapterAt(pathname, chapters.map((c) => c.href));
  const level = at < 0 ? 1 : levelAt(pathname, chapters[at].href);
  const [columnPick, setColumnPick] = useState(initialColumn);
  const column = columnPick ?? (size ? chaptersFor(size) : "names");
  const [tabs, setTabs] = useState<Span[] | null>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const { motion } = useAppearance();

  // The camera for a place in the book: a second level's zoom in the spread (D8), or none.
  const spreadAt = (chapter: number): SpreadLayout | null => {
    if (!size || form !== "spread") return null;
    const layout = layoutBook({ window: size, form, at: chapter, pages: chapters.length, tabs: [], chapters: column });
    return layout.form === "spread" ? layout : null;
  };
  const cameraAt = (place: Place): Camera => {
    const layout = place.level === 2 ? spreadAt(place.at) : null;
    return layout ? zoomCamera(layout) : NO_CAMERA;
  };
  const { turn, onPicture } = useTurn(pathname, { at, level }, motion, form, cameraAt);

  let camera: BookCamera | undefined;
  if (form === "spread" && level === 2) {
    const layout = spreadAt(at);
    if (!layout) camera = "pending";
    else {
      const zoom = zoomCamera(layout);
      const { x, y } = layout.pages[0].rect;
      camera = { transform: cameraTransform(zoom, { x, y }), scale: zoom.scale, pageHeight: shownHeight(layout, zoom) };
    }
  }

  useEffect(() => {
    document.cookie = `${FORM_COOKIE}=${form}; path=/; max-age=31536000; samesite=lax`;
  }, [form]);
  useEffect(() => {
    if (columnPick) document.cookie = `${CHAPTERS_COOKIE}=${columnPick}; path=/; max-age=31536000; samesite=lax`;
  }, [columnPick]);

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
    <FrameContext.Provider value={{ form, motion, turn, chapters, at, level, column, window: size, tabs, onPicture }}>
      <style href="book-frame" precedence="default">
        {bookFrameCss()}
      </style>
      <div className="book-frame" data-form={form} data-chapters={columnPick ?? undefined}>
        {/* The strip and the chapter column show the new chapter halfway through a turn. */}
        {form === "spread" ? (
          <ViewTransition name="book-strip" update={motion === "none" ? "none" : "turn-strip"} default="none">
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
          </ViewTransition>
        ) : (
          <ViewTransition name="book-chapters" update={motion === "none" ? "none" : "turn-strip"} default="none">
            <nav aria-label="Chapters" className="book-chapters">
              <div className="book-chapters-head">
                <span className="book-chapters-brand">
                  <Brand />
                </span>
                <span className="grow" />
                <ColumnToggle column={column} onPick={setColumnPick} />
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
          </ViewTransition>
        )}
        <div className="book-desk">
          <Book form={form} order={bookOrder(at, chapters.length)} camera={camera}>
            {children}
          </Book>
        </div>
      </div>
    </FrameContext.Provider>
  );
}

/** How often the frame looks whether a turn is over, to take its riffled leaves away. */
const RIFFLE_CHECK_MS = 1000;

/** Whether a view transition is animating. Removing a picture's element mid-turn would end it. */
const turning = () =>
  document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));

/**
 * The turn of the move to `pathname`, at `place`, worked out as the page renders, so the
 * arriving page renders its riffled leaves in the same commit, and the camera's move with it
 * (`cameraAt` gives a place's camera). Another page of the same level, or any move with motion
 * off, doesn't turn. Also returns `onPicture`, which moves each of the turn's pictures with the
 * camera as the browser takes it, and the book's own picture with the first.
 */
function useTurn(
  pathname: string,
  place: Place,
  motion: Motion,
  form: BookForm,
  cameraAt: (place: Place) => Camera,
): { turn: FrameTurn; onPicture: BookFrameContext["onPicture"] } {
  const [state, setState] = useState({ pathname, place, turn: NO_TURN });
  let current = state;
  if (state.pathname !== pathname) {
    const move = motion === "none" ? null : moveBetween(state.place, place, form);
    let camera: CameraMove | null = null;
    if (move?.zoom) {
      const timing = moveTiming(move);
      camera = { from: cameraAt(state.place), to: cameraAt(place), start: timing.zoomStart, duration: timing.zoomEnd - timing.zoomStart };
    }
    current = {
      pathname,
      place,
      turn: {
        id: state.turn.id + 1,
        way: move?.way ?? null,
        riffled: move?.riffled ?? [],
        zoom: move?.zoom ?? null,
        camera,
      },
    };
    setState(current);
  }
  const { turn } = current;

  // The turn whose pictures the browser is taking, and whether the book's own has moved.
  const taking = useRef({ turn: NO_TURN, bookMoved: false });

  // turns.css reads the way, how many leaves riffle and how the camera moves from <html>. Layout
  // effects run before the browser takes the turn's new pictures and starts their animations.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (turn.way) html.setAttribute("data-turn", turn.way);
    else html.removeAttribute("data-turn");
    html.setAttribute("data-riffles", String(turn.riffled.length));
    if (turn.way && turn.zoom) html.setAttribute("data-zoom", turn.zoom);
    else html.removeAttribute("data-zoom");
    taking.current = { turn, bookMoved: false };
  }, [turn]);

  const onPicture = useCallback((name: string, taken: PictureTaken) => {
    const move = taking.current.turn.camera;
    if (!move) return undefined;
    const moving = [moveWithCamera(name, taken === "old" ? move.from : move.to, move)];
    if (!taking.current.bookMoved) {
      taking.current.bookMoved = true;
      moving.push(moveWithCamera("book", move.to, move));
    }
    return () => moving.forEach((animation) => animation.cancel());
  }, []);

  useEffect(() => {
    if (turn.riffled.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const clear = () => {
      if (turning()) timer = setTimeout(clear, RIFFLE_CHECK_MS);
      else setState((s) => (s.turn.id === turn.id ? { ...s, turn: { ...s.turn, riffled: [] } } : s));
    };
    timer = setTimeout(clear, RIFFLE_CHECK_MS);
    return () => clearTimeout(timer);
  }, [turn]);

  return { turn, onPicture };
}

/** Narrows the chapter column to icons, or widens it to names (D15). A phone has no such button. */
function ColumnToggle({ column, onPick }: { column: ChapterColumn; onPick: (column: ChapterColumn) => void }) {
  const names = column === "names";
  const label = names ? "Narrow the chapters to icons" : "Widen the chapters to names";
  const Icon = names ? PanelLeftClose : PanelLeftOpen;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="book-chapters-toggle size-7 text-muted-foreground"
      aria-label={label}
      title={label}
      aria-pressed={!names}
      onClick={() => onPick(names ? "icons" : "names")}
    >
      <Icon aria-hidden className="size-4" />
    </Button>
  );
}

/** The brand; on a phone's chapter column, its first letter. */
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
