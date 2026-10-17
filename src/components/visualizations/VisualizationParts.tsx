"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  VISUALIZATIONS,
  VISUALIZATION_GROUPS,
  visualizationShot,
  type Visualization,
} from "@/lib/auth/access";
import { cn } from "@/lib/utils";

/** The Visualizations chapter's own page, with `id` picked, as the way back from a visualization's page leaves it. */
export function visualizationsHref(id?: string): string {
  return id ? `/dashboard/visualizations?show=${encodeURIComponent(id)}` : "/dashboard/visualizations";
}

/** Whether a visualization is a book view, drawing one book at a time. */
export const isSmall = (visualization: Visualization) => visualization.group === "Book views";

/** Whether this viewer can't open a visualization: a guest, on a page that needs an account. */
export const isLocked = (visualization: Visualization, signedIn: boolean) =>
  visualization.access === "account" && !signedIn;

/** A row's figure, as a contents gives one: what it needs, or how much of a page it takes. */
function figureOf(visualization: Visualization, signedIn: boolean): string {
  if (isLocked(visualization, signedIn)) return "Account";
  return isSmall(visualization) ? "small" : "full page";
}

/** "9 visualizations · 5 small, 4 full page", for a folio. */
export function visualizationCounts(): { all: string; split: string } {
  const small = VISUALIZATIONS.filter(isSmall).length;
  return {
    all: `${VISUALIZATIONS.length} visualizations`,
    split: `${small} small, ${VISUALIZATIONS.length - small} full page`,
  };
}

type RowsProps = {
  /** The visualization shown or open, marked in the list. */
  currentId: string | null;
  signedIn: boolean;
  /** Where a row goes: the visualization's page, unless given. */
  hrefOf?: (visualization: Visualization) => string;
  /**
   * Called when a row is pressed, before its link goes; it may stop the link, as the chapter's
   * own page does to show the visualization instead.
   */
  onPick?: (visualization: Visualization, event: MouseEvent<HTMLElement>) => void;
  /** The current row's "Jump to page" tag, on the chapter's own page, where a press only shows. */
  jumpTag?: boolean;
  /** The chapter's own page has room for a bigger row. */
  size: "large" | "small";
};

/**
 * The visualizations as a contents (plans/book-ui.md D18), group by group: each a row with its
 * name, a dotted leader and its figure. A row a guest can't open shows, but doesn't link.
 */
export function VisualizationRows({ currentId, signedIn, hrefOf = (v) => v.href, onPick, jumpTag = false, size }: RowsProps) {
  return (
    <div className="flex flex-col gap-3">
      {VISUALIZATION_GROUPS.map((group) => (
        <section key={group} aria-label={group} className="flex flex-col gap-1">
          <h2 className="book-sc">{group}</h2>
          <ul className="-mx-2.5 flex flex-col gap-px">
            {VISUALIZATIONS.filter((visualization) => visualization.group === group).map((visualization) => {
              const current = visualization.id === currentId;
              const locked = isLocked(visualization, signedIn);
              const row = cn(
                "visualization-row flex w-full items-baseline gap-2 rounded-md px-2.5 text-left hover:bg-accent",
                size === "large" ? "py-1.5" : "py-[7px]",
                current && "bg-accent",
              );
              const inner = (
                <>
                  <span
                    className={cn(
                      "min-w-0 truncate font-heading leading-[1.25]",
                      size === "large" ? "text-[17px]" : "text-sm",
                      current ? "font-bold" : "font-medium",
                    )}
                  >
                    {visualization.label}
                  </span>
                  <span aria-hidden className="min-w-3 flex-1 -translate-y-[3px] border-b-[1.5px] border-dotted border-muted-foreground opacity-55" />
                  {current && jumpTag && !locked ? (
                    <span data-jump className="rounded-sm bg-primary px-2 py-[5px] text-[11px] leading-none font-bold whitespace-nowrap text-primary-foreground">
                      Jump to page
                    </span>
                  ) : (
                    <span className="font-mono text-[11.5px] leading-none whitespace-nowrap text-muted-foreground">
                      {figureOf(visualization, signedIn)}
                    </span>
                  )}
                </>
              );
              return (
                <li key={visualization.id}>
                  {locked ? (
                    // A guest sees it listed, and may show it, but not open it.
                    onPick ? (
                      <button
                        type="button"
                        aria-label={`Show ${visualization.label}`}
                        aria-current={current ? "true" : undefined}
                        className={row}
                        onClick={(event) => onPick(visualization, event)}
                      >
                        {inner}
                      </button>
                    ) : (
                      <span className={cn(row, "text-muted-foreground hover:bg-transparent")}>{inner}</span>
                    )
                  ) : (
                    <Link
                      href={hrefOf(visualization)}
                      aria-current={current ? "true" : undefined}
                      className={row}
                      onClick={(event) => onPick?.(visualization, event)}
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * A visualization's screenshot in the theme on screen, taken by `npm run demos:shots`
 * (`visualizationShot`). Until one is taken, the box says so.
 */
export function VisualizationShot({ visualization, className }: { visualization: Visualization; className?: string }) {
  const [missing, setMissing] = useState(false);
  const box = cn("aspect-video w-full flex-none rounded-md border bg-page-alt", className);
  if (missing) {
    return <div className={cn(box, "flex items-center justify-center text-xs text-muted-foreground")}>No screenshot taken yet</div>;
  }
  const alt = `${visualization.label}, a screenshot`;
  return (
    <div className={cn(box, "overflow-hidden")}>
      {/* Screenshots are fixed files, which next/image would only pass through. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={visualizationShot(visualization.id, "light")} alt={alt} onError={() => setMissing(true)} className="size-full object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={visualizationShot(visualization.id, "dark")} alt={alt} onError={() => setMissing(true)} className="hidden size-full object-contain dark:block" />
    </div>
  );
}
