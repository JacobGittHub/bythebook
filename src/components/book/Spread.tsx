"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";
import { BookPage, Bookmark, PageTab } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { roman } from "@/lib/book/chapters";
import { SLIDE_SHOWN, chaptersFor, layoutBook, type BookLayout } from "@/lib/book/layout";
import { riffleBookmarkX } from "@/lib/book/turns";

// What a page of the dashboard renders: its pages, in the frame's book (plans/book-ui.md D1,
// D4, D8, D15). A spread is a left page and a right page; in the one-page form they are the
// two halves of one page. Each page carries its own bookmark (or, in the one-page form, its
// page tab), placed by the book's layout under the current chapter's tab.
//
// Each page is a view transition named after its route (D14), so on a move to another chapter
// the page leaving and the page arriving are separate pictures, which turns.css turns. Its
// classes say only which page it is and whether it leaves or arrives; the way is the frame's.

/** One page's content: its running head, its folio and its body. */
export type PageContent = { head?: ReactNode; folio?: ReactNode; body: ReactNode };

/** The book's layout for the current chapter, slid or not, once the browser has the window. */
function useLayout(slid: boolean): BookLayout | null {
  const { form, chapters, at, window, tabs } = useBookFrame();
  if (at < 0 || !window) return null;
  return layoutBook({
    window,
    form,
    at,
    pages: chapters.length,
    slide: slid ? SLIDE_SHOWN : null,
    tabs: tabs ?? [],
    chapters: chaptersFor(window),
  });
}

/** Where the current page's bookmark or page tab goes. */
function marksOf(layout: BookLayout | null, at: number, measured: boolean) {
  if (!layout) return { bookmark: null, pageTab: null };
  if (layout.form === "spread") return { bookmark: measured ? layout.bookmarks[at] : null, pageTab: null };
  return { bookmark: null, pageTab: layout.pageTabs[at] };
}

type PagePart = "l" | "r" | "s" | "ink";

/**
 * Wraps one of the page's pictures in its view transition: `page-<part>-in` when it arrives
 * and `page-<part>-out` when it leaves, under a name from the route. With motion off it takes
 * no part, so the browser has nothing to picture.
 */
function PagePicture({ part, children }: { part: PagePart; children: ReactNode }) {
  const { motion } = useBookFrame();
  const route = usePathname().replace(/[^a-z0-9]+/gi, "-");
  const off = motion === "none";
  return (
    <ViewTransition
      name={`page-${part}${route}`}
      enter={off ? "none" : `page-${part}-in`}
      exit={off ? "none" : `page-${part}-out`}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/**
 * The leaves a jump of several chapters riffles past (D13), each its chapter's blank page with
 * its bookmark or page tab (D4). They are drawn under the pages, where only the turn's pictures
 * show them, and the frame takes them away once the turn is over.
 */
function RiffledLeaves({ layout }: { layout: BookLayout | null }) {
  const { turn } = useBookFrame();
  if (!layout || !turn.way || turn.riffled.length === 0) return null;
  const leaf = turn.way === "forward" ? "right" : "left";

  return turn.riffled.map((chapter, k) => {
    let page: ReactNode;
    if (layout.form === "spread") {
      const mark = layout.bookmarks[chapter];
      page = (
        <BookPage
          side={leaf}
          className="book-riffle"
          aria-hidden
          marks={mark && <Bookmark x={riffleBookmarkX(mark, leaf, layout.pages[0].rect.width)} />}
        />
      );
    } else {
      const tab = layout.pageTabs[chapter];
      page = <BookPage side="single" className="book-riffle" aria-hidden marks={<PageTab top={tab.y} height={tab.height} />} />;
    }
    return (
      <ViewTransition
        key={`${turn.id}-${k}`}
        name={`riffle-${turn.id}-${k}`}
        enter={`riffle-${layout.form}-${k}`}
        exit="none"
        default="none"
      >
        {page}
      </ViewTransition>
    );
  });
}

/**
 * A page's spread. `slid`, for a second level, slides the book until only `SLIDE_SHOWN` of the
 * left page stays in view at the window's edge (D8, D9); in the one-page form a second level
 * shows only its right page.
 */
export function Spread({ left, right, slid = false }: { left: PageContent; right: PageContent; slid?: boolean }) {
  const { form, at, tabs } = useBookFrame();
  const layout = useLayout(slid);
  const { bookmark, pageTab } = marksOf(layout, at, tabs !== null);
  const tab = pageTab && <PageTab top={pageTab.y} height={pageTab.height} />;

  if (form === "single") {
    return (
      <>
        <RiffledLeaves layout={layout} />
        <PagePicture part="s">
          <BookPage side="single" head={slid ? right.head : left.head} folio={right.folio ?? left.folio} marks={tab}>
            {!slid ? (
              <div className="book-halves">
                <div className="book-half">{left.body}</div>
                <span className="book-half-rule" aria-hidden />
                <div className="book-half">{right.body}</div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">{right.body}</div>
            )}
          </BookPage>
        </PagePicture>
      </>
    );
  }

  return (
    <>
      <RiffledLeaves layout={layout} />
      <PagePicture part="l">
        <BookPage
          side="left"
          slid={slid}
          head={left.head}
          folio={left.folio}
          marks={bookmark?.side === "left" && <Bookmark x={bookmark.x} />}
        >
          {left.body}
        </BookPage>
      </PagePicture>
      <PagePicture part="r">
        <BookPage
          side="right"
          head={right.head}
          folio={right.folio}
          marks={bookmark?.side === "right" && <Bookmark x={bookmark.x} />}
        >
          {right.body}
        </BookPage>
      </PagePicture>
    </>
  );
}

/**
 * A page that isn't a spread yet (plans/book-ui.md Phase 3): its content as it was, across
 * both pages of the spread, or on the one page. The running heads name the chapter.
 *
 * Its content can't be cut at the spine, so in a turn it is a picture of its own, the ink, that
 * stays on the pages that lie still while the leaves between them turn blank (turns.css).
 */
export function InterimSpread({ children }: { children: ReactNode }) {
  const { form, chapters, at, tabs } = useBookFrame();
  const layout = useLayout(false);
  const { bookmark, pageTab } = marksOf(layout, at, tabs !== null);
  const chapter = chapters[at];
  const head = chapter && <span>{chapter.label}</span>;
  const folio = chapter && (
    <span className="ml-auto">
      Chapter {roman(at + 1)} of {roman(chapters.length)}
    </span>
  );

  if (form === "single") {
    return (
      <>
        <RiffledLeaves layout={layout} />
        <PagePicture part="s">
          <BookPage side="single" head={head} folio={folio} marks={pageTab && <PageTab top={pageTab.y} height={pageTab.height} />}>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </BookPage>
        </PagePicture>
      </>
    );
  }

  return (
    <>
      <RiffledLeaves layout={layout} />
      <PagePicture part="l">
        <BookPage side="left" head={head} marks={bookmark?.side === "left" && <Bookmark x={bookmark.x} />} />
      </PagePicture>
      <PagePicture part="r">
        <BookPage side="right" folio={folio} marks={bookmark?.side === "right" && <Bookmark x={bookmark.x} />} />
      </PagePicture>
      <PagePicture part="ink">
        <div className="book-interim">{children}</div>
      </PagePicture>
    </>
  );
}
