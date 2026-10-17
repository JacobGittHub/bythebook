"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Ink } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread } from "@/components/book/Spread";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { useViewer } from "@/context/Viewer";
import { VISUALIZATIONS } from "@/lib/auth/access";
import { roman } from "@/lib/book/chapters";
import { VisualizationRows, VisualizationShot, isLocked, visualizationCounts } from "./VisualizationParts";

/**
 * The Visualizations chapter's own page as a spread (plans/book-ui.md D18): the visualizations
 * as contents on the left page, grouped, and the picked one on the right, with its screenshot,
 * its summary and "Jump to page". As on the Overview, the first press on a row shows it, which
 * re-inks the right page, and a second press, or its "Jump to page" tag, opens its page. A
 * guest sees the visualizations that need an account, but is asked to sign in to open them.
 */
export function VisualizationsSpread({ initialId }: { initialId: string | null }) {
  const { form, chapters, at } = useBookFrame();
  const { signedIn } = useViewer();
  const [activeId, setActiveId] = useState(() =>
    VISUALIZATIONS.some((visualization) => visualization.id === initialId) ? initialId! : VISUALIZATIONS[0].id,
  );
  // Whether the reader picked the visualization shown, as against the one shown at the start.
  const [picked, setPicked] = useState(false);
  const shown = useRef<HTMLDivElement>(null);
  const index = VISUALIZATIONS.findIndex((visualization) => visualization.id === activeId);
  const active = VISUALIZATIONS[index];
  const locked = isLocked(active, signedIn);
  const counts = visualizationCounts();
  const number = chapters[at]?.number ?? null;

  return (
    <Spread
      left={{
        head: (
          <>
            <span>Visualizations</span>
            <span className="grow" />
            {number !== null && <span className="book-sc">Chapter {roman(number)}</span>}
          </>
        ),
        body: (
          <div className="visualizations-contents -mr-2.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-2.5" data-fit={form === "spread" || undefined}>
            <div>
              <h1 className="font-heading text-[34px] leading-[1.15] font-semibold tracking-[-0.01em]">Visualizations</h1>
              <p className="visualizations-lede mt-1.5 text-xs text-muted-foreground">
                Ways to see a book as a place. They are experiments, and change often. Pick one to see it on the right.
              </p>
            </div>
            <VisualizationRows
              size="large"
              currentId={activeId}
              signedIn={signedIn}
              jumpTag
              onPick={(visualization, event) => {
                if (picked && visualization.id === activeId) return;
                // A press meant for a new tab or window keeps doing that.
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                if ((event.target as Element).closest("[data-jump]")) return;
                event.preventDefault();
                setActiveId(visualization.id);
                setPicked(true);
                // Stacked on one page, the visualization shows below the contents.
                if (form === "single") requestAnimationFrame(() => shown.current?.scrollIntoView({ block: "start" }));
              }}
            />
          </div>
        ),
        folio: (
          <>
            <span>{counts.all}</span>
            <span className="grow" />
            <span>{counts.split}</span>
          </>
        ),
      }}
      right={{
        head: (
          <>
            <span className="book-sc">{active.group}</span>
            <span className="grow" />
            <span>{active.label}</span>
          </>
        ),
        body: (
          <Ink key={active.id} ref={shown} inked={picked} className="flex min-h-0 flex-1 flex-col gap-3.5">
            {/* On one page the running head is the contents', so the group goes here. */}
            {form === "single" && <span className="book-sc -mb-2">{active.group}</span>}
            <h2 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">{active.label}</h2>
            <VisualizationShot visualization={active} className="max-h-[52%]" />
            <p className="max-w-[60ch] text-sm leading-6">{active.summary}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {locked ? (
                <SignInPrompt action={`open the ${active.label}`} />
              ) : (
                <Button asChild size="sm">
                  <Link href={active.href}>Jump to page</Link>
                </Button>
              )}
              {active.status === "prototype" && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Prototype
                </Badge>
              )}
            </div>
          </Ink>
        ),
        folio: (
          <>
            <span>{active.group}</span>
            <span className="grow" />
            <span>
              {index + 1} of {VISUALIZATIONS.length}
            </span>
          </>
        ),
      }}
    />
  );
}
