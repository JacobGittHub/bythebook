import type { ReactNode } from "react";
import { BOOK_VIEWS, type BookViewId } from "@/lib/books/views";

/** A small drawing of each view, for its button. */
export function BookViewIcon({ view }: { view: BookViewId }) {
  const icons: Record<BookViewId, ReactNode> = {
    "ply-columns": (
      <>
        <path d="M3 10 C6 10 6 5 9 5 M3 10 C6 10 6 15 9 15 M9 5 C12 5 12 3.5 15 3.5 M9 5 C12 5 12 7 15 7 M9 15 H15" />
        <circle cx="3" cy="10" r="1.6" />
        <circle cx="9" cy="5" r="1.4" />
        <circle cx="9" cy="15" r="1.4" />
      </>
    ),
    metro: (
      <>
        <path d="M2 10 H18" strokeWidth="2.4" />
        <path d="M6 10 V6 L8 4 H15" />
        <path d="M10 10 V14 L12 16 H17" />
        <path d="M18 8 V12 M15 2.5 V5.5 M17 14.5 V17.5" />
      </>
    ),
    spine: (
      <>
        <path d="M2 10 H18" strokeWidth="2.4" />
        <path d="M6 10 C8 10 8 5 10 5 M10 10 C12 10 12 15 14 15 M13 10 C14.5 10 14.5 6 16 6" />
        <circle cx="10" cy="5" r="1.4" />
        <circle cx="14" cy="15" r="1.4" />
      </>
    ),
    icicle: (
      <>
        <rect x="2" y="2.5" width="4.5" height="15" rx="0.8" />
        <rect x="7.8" y="2.5" width="4.5" height="9" rx="0.8" />
        <rect x="7.8" y="12.5" width="4.5" height="5" rx="0.8" />
        <rect x="13.6" y="2.5" width="4.5" height="5" rx="0.8" />
        <rect x="13.6" y="8.5" width="4.5" height="3" rx="0.8" />
      </>
    ),
    "branch-points": (
      <>
        <path d="M2 10 H8 M8 10 V5 H17 M8 10 V15 H13 M13 15 V12.5 H18" />
        <rect x="6.6" y="8.6" width="2.8" height="2.8" rx="0.6" />
        <rect x="11.6" y="13.6" width="2.8" height="2.8" rx="0.6" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {icons[view]}
    </svg>
  );
}

/**
 * The vertical switch between the five book views, along the left edge of the window that
 * shows them.
 */
export function BookViewRail({
  view,
  onChange,
  className = "",
}: {
  view: BookViewId;
  onChange: (view: BookViewId) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Book view" className={`flex shrink-0 flex-col gap-1 ${className}`}>
      {BOOK_VIEWS.map((option) => {
        const active = option.id === view;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active ? "btn-primary" : "btn-ghost"
            }`}
          >
            <BookViewIcon view={option.id} />
          </button>
        );
      })}
    </div>
  );
}
