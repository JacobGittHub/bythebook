"use client";

import { ViewTransition, type ReactNode } from "react";
import { BookPage, Bookmark, PageTab } from "@/components/book/Book";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { SPIKE_PAGES, type SpikePage } from "./spike";
import { useSpike } from "./SpikeFrame";

// The spike's pages. Each page is a named view transition, named after its route, so a move
// to another page is the old page leaving and the new one arriving, each in its own group. A
// pair under one name would let the browser stack the two pictures, and WebKit ignores z-index
// between them; groups take it everywhere. The turn's CSS (turns.css) animates them by type.

const turn = (part: string, way: "in" | "out") => ({
  "turn-forward": `turn-fwd-${part}-${way}`,
  "turn-back": `turn-back-${part}-${way}`,
  default: "none",
});

type Half = { head: ReactNode; folio: ReactNode; body: ReactNode };

export function SpikeBook({ page }: { page: SpikePage }) {
  const { form, marks, tabs } = useSpike();
  const { left, right } = SPREADS[page];
  const mark = marks[page];
  const tab = tabs[page];

  if (form === "single") {
    return (
      <ViewTransition key={page} name={`page-single-${page}`} enter={turn("s", "in")} exit={turn("s", "out")} default="none">
        <BookPage
          side="single"
          className="flex-1"
          head={left.head}
          folio={right.folio}
          marks={tab && <PageTab top={tab.top} height={tab.height} />}
        >
          <div className="flex min-h-0 flex-1 gap-6 overflow-auto">
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">{left.body}</div>
            <div className="w-px flex-none bg-rule" />
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">{right.body}</div>
          </div>
        </BookPage>
      </ViewTransition>
    );
  }

  return (
    <>
      <ViewTransition key={`${page}-left`} name={`page-left-${page}`} enter={turn("l", "in")} exit={turn("l", "out")} default="none">
        <BookPage
          side="left"
          className="flex-[0_0_50%]"
          head={left.head}
          folio={left.folio}
          marks={mark?.side === "left" && <Bookmark x={mark.x} />}
        >
          {left.body}
        </BookPage>
      </ViewTransition>
      <ViewTransition key={`${page}-right`} name={`page-right-${page}`} enter={turn("r", "in")} exit={turn("r", "out")} default="none">
        <BookPage
          side="right"
          className="flex-1"
          head={right.head}
          folio={right.folio}
          marks={mark?.side === "right" && <Bookmark x={mark.x} />}
        >
          {right.body}
        </BookPage>
      </ViewTransition>
    </>
  );
}

const title = (text: string) => <h1 className="font-heading text-[26px] leading-tight font-semibold">{text}</h1>;
const smallCaps = (text: string) => (
  <span className="ml-auto font-heading text-[10.5px] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
    {text}
  </span>
);
const leaderRow = (name: string, fig: string, key = name) => (
  <div key={key} className="flex items-baseline gap-2 py-1.5">
    <span className="font-heading text-[15px]">{name}</span>
    <span className="grow translate-y-[-3px] border-b border-dotted border-rule" />
    <span className="font-mono text-xs text-muted-foreground">{fig}</span>
  </div>
);
const prose = (text: string) => <p className="max-w-[60ch] text-sm leading-relaxed">{text}</p>;

const BOOKS = [
  ["Caro-Kann Defense", "256"],
  ["Italian Game", "338"],
  ["King's Gambit", "75"],
  ["London System", "120"],
  ["Queen's Gambit", "198"],
  ["Sicilian Najdorf", "247"],
];

const SPREADS: Record<SpikePage, { left: Half; right: Half }> = {
  overview: {
    left: {
      head: <span>Overview</span>,
      folio: <span>Chapter I of IV</span>,
      body: (
        <>
          {title("Contents")}
          <div className="flex flex-col">
            {SPIKE_PAGES.map((p) => leaderRow(p.label, p.fig, p.key))}
          </div>
        </>
      ),
    },
    right: {
      head: smallCaps("The spike"),
      folio: <span className="ml-auto">i</span>,
      body: (
        <>
          {title("Page turns")}
          {prose(
            "Pick a tab in the strip. A page further on turns forward: the right page folds to the spine, then the next left page opens from it. A page further back turns the other way.",
          )}
          {prose(
            "The browser turns pictures of the pages, so the Explorer's board costs the turn nothing. Each page's bookmark is part of its picture and turns with it.",
          )}
        </>
      ),
    },
  },
  explorer: {
    left: {
      head: <span>Sicilian Defense</span>,
      folio: <span>Sicilian Defense: Najdorf Variation</span>,
      body: (
        <div className="flex justify-center">
          <BoardDisplay fen="rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6" size="lg" />
        </div>
      ),
    },
    right: {
      head: smallCaps("Opening explorer"),
      folio: <span className="ml-auto">312K master games</span>,
      body: (
        <>
          {title("Master moves")}
          <div className="flex flex-col">
            {[
              ["Be3", "38%"],
              ["Bg5", "21%"],
              ["Be2", "14%"],
              ["f3", "9%"],
              ["Bc4", "6%"],
            ].map(([m, f]) => leaderRow(m, f))}
          </div>
        </>
      ),
    },
  },
  library: {
    left: {
      head: <span>Library</span>,
      folio: <span>6 books</span>,
      body: (
        <>
          {title("Your books")}
          <div className="flex flex-col">{BOOKS.map(([n, c]) => leaderRow(n, c))}</div>
        </>
      ),
    },
    right: {
      head: smallCaps("White"),
      folio: <span className="ml-auto">338 of 1,000 positions</span>,
      body: (
        <>
          {title("Italian Game")}
          {prose("41 lines, 9.4 plies on average, the longest 17. From Wikibooks, CC BY-SA 4.0.")}
        </>
      ),
    },
  },
  settings: {
    left: {
      head: <span>Settings</span>,
      folio: <span>Appearance</span>,
      body: (
        <>
          {title("Appearance")}
          {prose("Theme, page turns and vibes. The spike keeps them in the strip for now.")}
        </>
      ),
    },
    right: {
      head: smallCaps("Your data"),
      folio: <span className="ml-auto">Account</span>,
      body: (
        <>
          {title("Your books and account")}
          {prose("Back up your books, restore them, or sign in to keep them in your account.")}
        </>
      ),
    },
  },
};
