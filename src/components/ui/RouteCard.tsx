import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/shadcn/badge";
import type { PageStatus } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

const STATUS_TAGS: Partial<Record<PageStatus, string>> = {
  coming_soon: "Coming soon",
  prototype: "Prototype",
};

type Props = {
  label: string;
  summary: string;
  status: PageStatus;
  /** Where the button routes. Without it the card is not a link (see `note`). */
  href?: string;
  /** Shown under the summary, for example why the card can't be opened. */
  note?: ReactNode;
  /** A larger card with a stronger edge, for the page's featured entry. */
  featured?: boolean;
  /** A small drawing before the label. */
  icon?: ReactNode;
};

/**
 * A button that routes to a page. The "Jump to page" tag is what tells a visitor that
 * pressing it leaves the current page. It is a panel to a vibe (`data-slot="panel"`).
 */
export function RouteCard({ label, summary, status, href, note, featured = false, icon }: Props) {
  const tag = STATUS_TAGS[status];
  // A featured card isn't faded when it can't be opened: its `note` says why.
  const className = cn(
    "group relative block rounded-md border bg-card text-card-foreground transition-colors",
    featured ? "border-muted-foreground p-4" : "p-3",
    href ? "hover:border-foreground" : featured ? "" : "opacity-70",
  );

  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        <h3 className={cn("font-heading font-semibold", featured && "text-xl")}>
          {label}
        </h3>
        {tag ? (
          <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
            {tag}
          </Badge>
        ) : null}
        {href ? (
          <Badge
            variant="outline"
            className="ml-auto shrink-0 text-muted-foreground transition-colors group-hover:border-foreground group-hover:text-foreground"
          >
            Jump to page
          </Badge>
        ) : null}
      </div>
      <p
        className={cn("text-muted-foreground", featured ? "mt-1.5 max-w-3xl" : "mt-1 text-sm")}
      >
        {summary}
      </p>
      {note ? <div className="mt-2">{note}</div> : null}
    </>
  );

  if (!href) {
    return (
      <div data-slot="panel" className={className}>
        {body}
      </div>
    );
  }

  return (
    <Link data-slot="panel" href={href} aria-label={`Jump to ${label}`} className={className}>
      {body}
    </Link>
  );
}
