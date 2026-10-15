"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  ViewTransition,
  type ReactNode,
} from "react";
import { Book, type BookForm } from "@/components/book/Book";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { cn } from "@/lib/utils";
import { SPIKE_BASE, SPIKE_PAGES, pageIndex, turnType } from "./spike";

// The spike's frame: the strip (or, in the one-page form, the chapter column), the desk and the
// book's cover and page edges. The pages come from the route, so they are what turns. Where
// each bookmark and page tab goes is measured here; the book's layout function replaces that.

type Mark = { side: "left" | "right"; x: number };
type Tab = { top: number; height: number };

const SpikeContext = createContext<{
  form: BookForm;
  marks: Record<string, Mark>;
  tabs: Record<string, Tab>;
}>({ form: "spread", marks: {}, tabs: {} });

export const useSpike = () => useContext(SpikeContext);

const NARROW = "(max-width: 1099px)";
const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** The strip and the chapter column change at the turn's middle, not at its start. */
const STRIP_TURN = { "turn-forward": "turn-strip", "turn-back": "turn-strip", default: "none" };

export function SpikeFrame({ children }: { children: ReactNode }) {
  const current = usePathname().split("/").pop() ?? "overview";
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [picked, setPicked] = useState<BookForm | null>(null);
  const form = picked ?? (narrow ? "single" : "spread");
  const [slow, setSlow] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const bookRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    document.documentElement.dataset.turnSpeed = slow ? "slow" : "normal";
  }, [slow]);

  const measure = useCallback(() => {
    const book = bookRef.current?.getBoundingClientRect();
    if (!book) return;
    const nextMarks: Record<string, Mark> = {};
    const nextTabs: Record<string, Tab> = {};
    for (const [key, el] of navRefs.current) {
      const r = el.getBoundingClientRect();
      if (form === "spread") {
        // The left page is half the book; a page's marks sit inside its 1px border.
        const cx = r.left + r.width / 2;
        const spine = book.left + book.width / 2;
        nextMarks[key] = cx < spine ? { side: "left", x: cx - book.left - 1 } : { side: "right", x: cx - spine };
      } else {
        nextTabs[key] = { top: r.top - book.top - 1, height: r.height };
      }
    }
    setMarks(nextMarks);
    setTabs(nextTabs);
  }, [form]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (bookRef.current) observer.observe(bookRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const at = Math.max(0, pageIndex(current));
  const edges = { left: 4 + at * 3, right: 4 + (SPIKE_PAGES.length - 1 - at) * 3 };
  const navRef = (key: string) => (el: HTMLElement | null) => {
    if (el) navRefs.current.set(key, el);
    else navRefs.current.delete(key);
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={form}
        onValueChange={(v) => v && setPicked(v as BookForm)}
        aria-label="Form"
      >
        <ToggleGroupItem value="spread">Spread</ToggleGroupItem>
        <ToggleGroupItem value="single">One page</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={slow ? "slow" : "normal"}
        onValueChange={(v) => v && setSlow(v === "slow")}
        aria-label="Speed"
      >
        <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
        <ToggleGroupItem value="slow">Slow ×4</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  const link = (key: string, className: string, body: ReactNode) => (
    <Link
      key={key}
      ref={navRef(key)}
      href={`${SPIKE_BASE}/${key}`}
      transitionTypes={key === current ? undefined : [turnType(current, key)]}
      aria-current={key === current ? "page" : undefined}
      className={className}
    >
      {body}
    </Link>
  );

  return (
    <SpikeContext.Provider value={{ form, marks, tabs }}>
      <div className="flex h-dvh flex-col overflow-hidden bg-desk text-foreground">
        {form === "spread" ? (
          <>
            <ViewTransition name="book-strip" update={STRIP_TURN} default="none">
              <nav className="flex h-[50px] flex-none items-center gap-3.5 px-[26px]">
                <span className="font-heading text-[19px] font-semibold">ByTheBook</span>
                <span className="ml-2 flex items-center text-[13px] text-muted-foreground">
                  {SPIKE_PAGES.map((p) =>
                    link(
                      p.key,
                      cn(
                        "px-2 py-[7px] hover:text-foreground",
                        p.key === current && "font-bold text-foreground shadow-[inset_0_-2px_0_var(--bookmark)]",
                      ),
                      p.label,
                    ),
                  )}
                </span>
                <span className="grow" />
                {controls}
              </nav>
            </ViewTransition>
            <Book ref={bookRef} form="spread" edges={edges} className="mx-[26px] mt-3.5 mb-[22px] flex-1">
              {children}
            </Book>
          </>
        ) : (
          <div className="flex min-h-0 flex-1">
            <ViewTransition name="book-chapters" update={STRIP_TURN} default="none">
              <nav className="flex w-[214px] flex-none flex-col py-[18px] pl-[18px] whitespace-nowrap">
                <span className="h-[30px] font-heading text-[19px] font-semibold">ByTheBook</span>
                <div className="mt-[30px] flex flex-col gap-0.5">
                  {SPIKE_PAGES.map((p) =>
                    link(
                      p.key,
                      cn(
                        "flex h-8 items-center gap-2 pr-4 pl-2 text-[13px] text-muted-foreground hover:text-foreground",
                        p.key === current && "font-bold text-foreground",
                      ),
                      <>
                        <span className="grow">{p.label}</span>
                        <span className="font-mono text-[11.5px] font-medium text-muted-foreground">{p.fig}</span>
                      </>,
                    ),
                  )}
                </div>
                <div className="mt-auto pr-2.5">{controls}</div>
              </nav>
            </ViewTransition>
            {/* The page tab reaches out past the page edges by 10px, to the column's edge. The book runs
                on past the window's right edge (globals.css, .book-facing). */}
            <Book
              ref={bookRef}
              form="single"
              edges={{ left: 8, right: 6 }}
              className="my-[18px] flex-1"
              style={{ marginLeft: 19 }}
            >
              {children}
            </Book>
          </div>
        )}
      </div>
    </SpikeContext.Provider>
  );
}
