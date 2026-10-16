"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Ink } from "@/components/book/Book";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread, chapterFolio } from "@/components/book/Spread";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ACCESS_ROWS, type ContentsEntry } from "@/lib/auth/access";
import { roman } from "@/lib/book/chapters";
import { cn } from "@/lib/utils";

/** The gap between one word of the description appearing and the next. */
const STREAM_WORD_MS = 45;

/** A paragraph that writes itself out a word at a time (see `.stream-word` in globals.css). */
function StreamedText({ text }: { text: string }) {
  return (
    <p className="max-w-[60ch] text-sm leading-6">
      {text.split(" ").map((word, index) => (
        <Fragment key={index}>
          <span className="stream-word" style={{ animationDelay: `${index * STREAM_WORD_MS}ms` }}>
            {word}
          </span>{" "}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * The Overview as a spread (plans/book-ui.md D10): the book's contents on the left page, a
 * chapter per row in book order with dotted leaders, then what an account adds and, for a
 * guest, `offer`; the picked chapter's demo and description on the right. Pressing a chapter
 * shows it, which re-inks the right page; pressing it again, or its "Jump to page" tag, goes
 * to its page. A chapter with no page yet, such as Vibes, only shows. Mouse, touch and
 * keyboard all work this way.
 */
export function OverviewSpread({ entries, offer }: { entries: ContentsEntry[]; offer?: ReactNode }) {
  const { form } = useBookFrame();
  const [activeIndex, setActiveIndex] = useState(0);
  // Whether the reader picked the chapter shown, as against the first one shown at the start.
  const [picked, setPicked] = useState(false);
  const shown = useRef<HTMLDivElement>(null);

  const active = entries[activeIndex];
  if (!active) return null;

  const pick = (index: number) => {
    setActiveIndex(index);
    setPicked(true);
    // Stacked on one page, the chapter shows below the contents.
    if (form === "single") requestAnimationFrame(() => shown.current?.scrollIntoView({ block: "start" }));
  };

  const contents = (
    <ol aria-label="Contents" className="-mx-2.5 flex flex-col gap-0.5">
      {entries.map((entry, index) => {
        const isActive = index === activeIndex;
        const isPicked = isActive && picked;
        const row = cn(
          "overview-chapter grid w-full grid-cols-[36px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-accent",
          isActive && "bg-accent",
        );
        const inner = (
          <>
            <span className="font-heading text-[15px] leading-[1.3] text-muted-foreground">{roman(index + 1)}</span>
            <span className="flex min-w-0 items-baseline gap-2">
              <span className={cn("truncate font-heading text-[19px] leading-[1.25]", isActive ? "font-bold" : "font-semibold")}>
                {entry.label}
              </span>
              <span aria-hidden className="min-w-3 flex-1 -translate-y-[3px] border-b-[1.5px] border-dotted border-muted-foreground opacity-55" />
              {isActive && entry.href ? (
                <span data-jump className="rounded-sm bg-primary px-2 py-[5px] text-[11px] leading-none font-bold whitespace-nowrap text-primary-foreground">
                  Jump to page
                </span>
              ) : (
                <span className="font-mono text-[11.5px] leading-none whitespace-nowrap text-muted-foreground">
                  {entry.status === "coming_soon" ? "Soon" : "Live"}
                </span>
              )}
            </span>
            <span className="overview-summary col-start-2 text-[12.5px] text-muted-foreground">{entry.summary}</span>
          </>
        );
        return (
          <li key={entry.label}>
            {entry.href ? (
              <Link
                href={entry.href}
                aria-label={isPicked ? `Jump to ${entry.label}` : `Show ${entry.label}`}
                aria-current={isActive ? "true" : undefined}
                className={row}
                onClick={(event) => {
                  if (isPicked) return;
                  // A press meant for a new tab or window keeps doing that.
                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  if ((event.target as Element).closest("[data-jump]")) return;
                  event.preventDefault();
                  pick(index);
                }}
              >
                {inner}
              </Link>
            ) : (
              <button type="button" aria-label={`Show ${entry.label}`} aria-current={isActive ? "true" : undefined} className={row} onClick={() => pick(index)}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );

  const accountTable = (
    <section className="flex flex-col gap-1.5">
      <h2 className="book-sc">What an account adds</h2>
      <table className="w-full table-fixed border-t border-rule text-left text-xs">
        <thead>
          <tr className="book-sc">
            <th scope="col" className="w-[36%] border-b border-rule py-1.5 pr-2 font-semibold">
              <span className="sr-only">Feature</span>
            </th>
            <th scope="col" className="border-b border-rule py-1.5 pr-2 font-semibold">Guest</th>
            <th scope="col" className="border-b border-rule py-1.5 font-semibold">Account</th>
          </tr>
        </thead>
        <tbody className="align-top text-muted-foreground">
          {ACCESS_ROWS.map((row) => (
            <tr key={row.feature}>
              <th scope="row" className="border-b border-rule py-1.5 pr-2 font-bold text-foreground">{row.feature}</th>
              <td className="border-b border-rule py-1.5 pr-2">{row.guest}</td>
              <td className="border-b border-rule py-1.5">{row.account}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {offer}
    </section>
  );

  const number = activeIndex + 1;
  return (
    <Spread
      left={{
        head: (
          <>
            <span>Overview</span>
            <span className="grow" />
            <span className="book-sc">Contents</span>
          </>
        ),
        body: (
          <div className="overview-contents -mr-2.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-2.5" data-fit={form === "spread" || undefined}>
            <div>
              <h1 className="font-heading text-[34px] leading-[1.15] font-semibold tracking-[-0.01em]">Contents</h1>
              <p className="overview-lede mt-1.5 text-xs text-muted-foreground">Every page of the book, in order. Pick a chapter to see it on the right.</p>
            </div>
            {contents}
            {accountTable}
          </div>
        ),
        folio: <span>ByTheBook, an opening trainer</span>,
      }}
      right={{
        head: (
          <>
            <span className="book-sc">Chapter {roman(number)}</span>
            <span className="grow" />
            <span>{active.label}</span>
          </>
        ),
        body: (
          <Ink key={active.label} ref={shown} inked={picked} className="flex min-h-0 flex-1 flex-col gap-3.5">
            {/* On one page the running head is the contents', so the chapter's number goes here. */}
            {form === "single" && <span className="book-sc -mb-2">Chapter {roman(number)}</span>}
            <h2 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">{active.label}</h2>
            {active.demo ? (
              // A looping GIF, which next/image would only pass through unoptimized.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.demo}
                alt={`${active.label} in use`}
                className="aspect-video max-h-[52%] w-full flex-none rounded-md border bg-page-alt object-contain"
              />
            ) : (
              <div className="flex aspect-video max-h-[52%] w-full flex-none items-center justify-center rounded-md border border-dashed bg-page-alt text-xs text-muted-foreground">
                {active.status === "coming_soon" ? "Coming soon" : "No demo recorded yet"}
              </div>
            )}
            <StreamedText text={active.details ?? active.summary} />
            {active.href ? (
              <Button asChild size="sm" className="self-start">
                <Link href={active.href}>Jump to page</Link>
              </Button>
            ) : (
              <Badge variant="outline" className="self-start font-normal text-muted-foreground">
                Coming soon
              </Badge>
            )}
          </Ink>
        ),
        folio: <span className="ml-auto">{chapterFolio(number, entries.length)}</span>,
      }}
    />
  );
}
