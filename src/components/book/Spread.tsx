"use client";

import type { ReactNode } from "react";
import { Book, BookPage, Bookmark, PageTab } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { bookOrder, roman } from "@/lib/book/chapters";
import { chaptersFor, layoutBook } from "@/lib/book/layout";

// What a page of the dashboard renders: its book, on the frame's desk (plans/book-ui.md D1,
// D4, D8, D15). A spread is a left page and a right page; in the one-page form they are the
// two halves of one page. Each page carries its own bookmark (or, in the one-page form, its
// page tab), placed by the book's layout under the current chapter's tab.

/** One page's content: its running head, its folio and its body. */
export type PageContent = { head?: ReactNode; folio?: ReactNode; body: ReactNode };

/** Where the current page's bookmark or page tab goes, for this slide. */
function useMarks(slide: number | null) {
  const { form, chapters, at, window, tabs } = useBookFrame();
  if (at < 0 || !window) return { bookmark: null, pageTab: null };
  const layout = layoutBook({
    window,
    form,
    at,
    pages: chapters.length,
    slide,
    tabs: tabs ?? [],
    chapters: chaptersFor(window),
  });
  if (layout.form === "spread") return { bookmark: tabs ? layout.bookmarks[at] : null, pageTab: null };
  return { bookmark: null, pageTab: layout.pageTabs[at] };
}

/**
 * A page's spread. `slide`, for a second level, is how much of the left page stays in view at
 * the window's edge (D8, D9); in the one-page form a second level shows only its right page.
 */
export function Spread({ left, right, slide = null }: { left: PageContent; right: PageContent; slide?: number | null }) {
  const { form, chapters, at } = useBookFrame();
  const { bookmark, pageTab } = useMarks(slide);
  const order = bookOrder(at, chapters.length);
  const tab = pageTab && <PageTab top={pageTab.y} height={pageTab.height} />;

  if (form === "single") {
    return (
      <Book form="single" order={order}>
        <BookPage side="single" head={slide === null ? left.head : right.head} folio={right.folio ?? left.folio} marks={tab}>
          {slide === null ? (
            <div className="book-halves">
              <div className="book-half">{left.body}</div>
              <span className="book-half-rule" aria-hidden />
              <div className="book-half">{right.body}</div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">{right.body}</div>
          )}
        </BookPage>
      </Book>
    );
  }

  return (
    <Book form="spread" order={order} slide={slide}>
      <BookPage
        side="left"
        head={left.head}
        folio={left.folio}
        marks={bookmark?.side === "left" && <Bookmark x={bookmark.x} />}
      >
        {left.body}
      </BookPage>
      <BookPage
        side="right"
        head={right.head}
        folio={right.folio}
        marks={bookmark?.side === "right" && <Bookmark x={bookmark.x} />}
      >
        {right.body}
      </BookPage>
    </Book>
  );
}

/**
 * A page that isn't a spread yet (plans/book-ui.md Phase 3): its content as it was, across
 * both pages of the spread, or on the one page. The running heads name the chapter.
 */
export function InterimSpread({ children }: { children: ReactNode }) {
  const { form, chapters, at } = useBookFrame();
  const { bookmark, pageTab } = useMarks(null);
  const chapter = chapters[at];
  const head = chapter && <span>{chapter.label}</span>;
  const folio = chapter && (
    <span className="ml-auto">
      Chapter {roman(at + 1)} of {roman(chapters.length)}
    </span>
  );
  const order = bookOrder(at, chapters.length);

  if (form === "single") {
    return (
      <Book form="single" order={order}>
        <BookPage side="single" head={head} folio={folio} marks={pageTab && <PageTab top={pageTab.y} height={pageTab.height} />}>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </BookPage>
      </Book>
    );
  }

  return (
    <Book form="spread" order={order}>
      <BookPage side="left" head={head} marks={bookmark?.side === "left" && <Bookmark x={bookmark.x} />} />
      <BookPage side="right" folio={folio} marks={bookmark?.side === "right" && <Bookmark x={bookmark.x} />} />
      <div className="book-interim">{children}</div>
    </Book>
  );
}
