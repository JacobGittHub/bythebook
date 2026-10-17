"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Ink } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread } from "@/components/book/Spread";
import { useViewer } from "@/context/Viewer";
import { VISUALIZATIONS } from "@/lib/auth/access";
import { VisualizationRows, isSmall, visualizationsHref } from "./VisualizationParts";

type Props = {
  /** The visualization this page is. */
  id: string;
  /** The page's first screen. */
  children: ReactNode;
  /** What the page holds below its first screen. */
  below?: ReactNode;
  /** The right page's folio, by default the visualization's group. */
  folio?: ReactNode;
  /** What the content is keyed by, so a change of it, such as another book, re-inks it (D13). */
  inkKey?: string;
  /** A book view's book, which the list's other book views keep. */
  bookId?: string | null;
};

/**
 * A visualization's own page, the Visualizations chapter's second level (plans/book-ui.md D18,
 * D8), which the camera zooms in on. The part of the left page in view lists the visualizations,
 * against the spine under the way back to the chapter's page, so another one opens without going
 * back, re-inking the right page; the book views keep the book that is open. The right page is
 * the visualization, laid out for the zoomed view.
 */
export function VisualizationLevel({ id, children, below, folio, inkKey, bookId = null }: Props) {
  const { form, turn } = useBookFrame();
  const { signedIn } = useViewer();
  const index = VISUALIZATIONS.findIndex((visualization) => visualization.id === id);
  const visualization = VISUALIZATIONS[index];
  // A move from another visualization's page doesn't turn (D13), so the page re-inks.
  const inked = turn.id > 0 && turn.way === null;
  const key = `${id}:${inkKey ?? ""}`;

  return (
    <Spread
      left={{
        head: (
          <>
            <span className="grow" />
            <span className="book-sc">Visualizations</span>
          </>
        ),
        body: (
          <>
            {/* Back to the chapter's page, with this visualization picked. */}
            <Link href={visualizationsHref(id)} className="book-back self-end">
              Back to all visualizations
            </Link>
            <div className="min-h-0 overflow-y-auto">
              <VisualizationRows
                size="small"
                currentId={id}
                signedIn={signedIn}
                hrefOf={(other) =>
                  isSmall(other) && bookId ? `${other.href}?book=${encodeURIComponent(bookId)}` : other.href
                }
              />
            </div>
          </>
        ),
        folio: (
          <>
            <span className="grow" />
            <span>
              {index + 1} of {VISUALIZATIONS.length}
            </span>
          </>
        ),
      }}
      right={{
        head: visualization && (
          <>
            <span className="book-sc">{visualization.group}</span>
            {/* On one page the head also holds the way back, and the title names the visualization. */}
            {form === "spread" && (
              <>
                <span className="grow" />
                <span className="truncate">{visualization.label}</span>
              </>
            )}
          </>
        ),
        body: (
          <Ink key={key} inked={inked} className="flex h-full min-h-0 flex-1 flex-col gap-3">
            {children}
          </Ink>
        ),
        below: below && (
          <Ink key={key} inked={inked}>
            {below}
          </Ink>
        ),
        folio: folio ?? <span>{visualization?.group}</span>,
      }}
    />
  );
}
