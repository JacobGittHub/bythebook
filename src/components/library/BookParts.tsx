import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { EXAMPLE_ID_PREFIX, creditLine } from "@/lib/books/examples";
import { MAX_BOOK_POSITIONS, type BookSide } from "@/lib/books/measures";
import type { BookOrigin, BookSummary } from "@/lib/library/types";
import { cn } from "@/lib/utils";

const formatCount = (n: number) => n.toLocaleString("en-US");

/** "1 position", "198 positions": a count with its noun. */
export function countOf(n: number, noun: string): string {
  return `${formatCount(n)} ${n === 1 ? noun : `${noun}s`}`;
}

/** White or Black, as a small square in the side's color and the word. */
export function SideTag({ side, className }: { side: BookSide; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 rounded-[2px] border border-[var(--view-white-edge)]",
          side === "white" ? "bg-[var(--view-white)]" : "bg-[var(--view-black)]",
        )}
      />
      {side === "white" ? "White" : "Black"}
    </span>
  );
}

/**
 * Whether a store book's publisher is verified. Until the Bookstore has its own tables
 * (plans/bookstore.md Phase 3), its only books are the example books, which ship with the app
 * and are ByTheBook's; the mark then comes from the publisher's account (D13).
 */
export function storeVerified(origin: BookOrigin): boolean {
  return origin.kind === "store" && origin.sourceId.startsWith(EXAMPLE_ID_PREFIX);
}

/**
 * A publisher: the name in its own highlight, and Verified or Unverified beside it, never
 * inside, so no name can imitate the mark (plans/bookstore.md D8).
 */
export function PublisherLabel({ name, verified }: { name: string; verified: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <span className="truncate rounded-sm bg-muted px-1.5 py-0.5 font-medium text-foreground">{name}</span>
      {verified ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground">
          <BadgeCheck aria-hidden="true" className="size-3.5" />
          Verified
        </span>
      ) : (
        <span className="shrink-0 text-muted-foreground">Unverified</span>
      )}
    </span>
  );
}

/** Where a book came from, in a sentence (D24). */
export function originText(origin: BookOrigin): string {
  switch (origin.kind) {
    case "own":
      return "Made by you.";
    case "store":
      return `Saved from the Bookstore, published by ${origin.publisher}.`;
    case "combined":
      return `Combined from ${origin.sources.length} ${origin.sources.length === 1 ? "book" : "books"}.`;
    case "import":
      return "Imported from a file.";
  }
}

/** The credit a book's source asks for, or null. */
export function originCredit(origin: BookOrigin): string | null {
  return origin.kind === "store" && origin.credit ? creditLine(origin.credit) : null;
}

/** A book's tags: its publisher, a combined book's sources, and the unconnected-lines flag. */
export function BookTags({ origin, summary }: { origin: BookOrigin; summary: BookSummary }) {
  const tags = [];
  if (origin.kind === "store") {
    tags.push(<PublisherLabel key="publisher" name={origin.publisher} verified={storeVerified(origin)} />);
  }
  if (origin.kind === "combined") {
    tags.push(
      <Badge key="combined" variant="outline">
        Combined from {origin.sources.length}
      </Badge>,
    );
  }
  if (summary.unconnected) {
    tags.push(
      <Badge key="unconnected" variant="outline" className="border-[var(--view-clash)] text-foreground">
        Unconnected lines
      </Badge>,
    );
  }
  if (!tags.length) return null;
  return <span className="flex min-w-0 flex-wrap items-center gap-1.5">{tags}</span>;
}

/** A book's numbers from its summary (D26): positions against the limit, lines, depth, clashes. */
export function BookMeasures({ summary, className }: { summary: BookSummary; className?: string }) {
  const items: [string, string][] = [
    ["Positions", `${formatCount(summary.positions)} / ${formatCount(MAX_BOOK_POSITIONS)}`],
    ["Lines", formatCount(summary.lines)],
    ["Average line", summary.averageDepth === null ? "–" : `${summary.averageDepth.toFixed(1)} plies`],
    ["Longest line", `${summary.maxDepth} plies`],
    ["Clashes", formatCount(summary.clashes)],
  ];
  return (
    <dl className={cn("flex flex-wrap gap-x-5 gap-y-1", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Where a book came from, with its source's credit and licence linked when it has one. */
export function OriginLine({ origin, className }: { origin: BookOrigin; className?: string }) {
  const credit = origin.kind === "store" ? origin.credit : null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {originText(origin)}
      {credit && (
        <>
          {" "}
          Source:{" "}
          <a href={credit.url} target="_blank" rel="noreferrer" className="underline">
            {credit.title}
          </a>
          , by {credit.author},{" "}
          <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">
            {credit.license}
          </a>
          .
        </>
      )}
    </p>
  );
}

/** The tag a button that routes to another page carries, in words (AGENTS.md "UI"). */
export function JumpTag() {
  return (
    <span className="rounded-sm border border-current/25 px-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
      Jump to page
    </span>
  );
}
