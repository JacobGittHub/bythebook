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
  /** Draws the card as the selected one. */
  active?: boolean;
  /** Called when the pointer or the keyboard focus lands on the card. */
  onActivate?: () => void;
};

/**
 * A button that routes to a page. The arrow beside the label is what tells a visitor that
 * pressing it leaves the current page.
 */
export function RouteCard({ label, summary, status, href, note, active, onActivate }: Props) {
  const tag = STATUS_TAGS[status];
  const className = `group block rounded-3xl border p-4 transition-colors ${
    active
      ? "border-[var(--text-primary)] bg-[var(--bg-card)]"
      : "border-[var(--border-card)] bg-[var(--bg-muted)]"
  } ${href ? "hover:border-[var(--text-primary)]" : "opacity-70"}`;

  const body = (
    <>
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-[var(--text-primary)]">{label}</h3>
        {tag ? (
          <span className="shrink-0 rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {tag}
          </span>
        ) : null}
        {href ? (
          <span
            aria-hidden="true"
            className="ml-auto shrink-0 text-lg leading-none text-[var(--text-primary)] transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
          >
            →
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{summary}</p>
      {note ? <div className="mt-2">{note}</div> : null}
    </>
  );

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link
      href={href}
      aria-label={`Go to ${label}`}
      className={className}
      onMouseEnter={onActivate}
      onFocus={onActivate}
    >
      {body}
    </Link>
  );
}
