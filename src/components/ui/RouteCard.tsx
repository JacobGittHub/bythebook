import Link from "next/link";
import type { ReactNode } from "react";
import type { PageStatus } from "@/lib/auth/access";

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
 * pressing it leaves the current page.
 */
export function RouteCard({ label, summary, status, href, note, featured = false, icon }: Props) {
  const tag = STATUS_TAGS[status];
  // A featured card isn't faded when it can't be opened: its `note` says why.
  const className = `group block rounded-3xl border bg-[var(--bg-muted)] transition-colors ${
    featured ? "border-[var(--text-muted)] p-6 shadow-sm" : "border-[var(--border-card)] p-4"
  } ${href ? "hover:border-[var(--text-primary)]" : featured ? "" : "opacity-70"}`;

  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon ? <span className="shrink-0 text-[var(--text-muted)]">{icon}</span> : null}
        <h3 className={`font-semibold text-[var(--text-primary)] ${featured ? "text-2xl" : ""}`}>
          {label}
        </h3>
        {tag ? (
          <span className="shrink-0 rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {tag}
          </span>
        ) : null}
        {href ? (
          <span className="ml-auto shrink-0 rounded-full border border-[var(--border-card)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] transition-colors group-hover:border-[var(--text-primary)] group-hover:text-[var(--text-primary)]">
            Jump to page
          </span>
        ) : null}
      </div>
      <p
        className={`text-[var(--text-muted)] ${featured ? "mt-2 max-w-3xl text-base" : "mt-1 text-sm"}`}
      >
        {summary}
      </p>
      {note ? <div className="mt-2">{note}</div> : null}
    </>
  );

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link href={href} aria-label={`Jump to ${label}`} className={className}>
      {body}
    </Link>
  );
}
