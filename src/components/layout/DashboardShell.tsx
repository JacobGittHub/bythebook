"use client";

import { useState, type ReactNode } from "react";

const iconButtonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--bg-sidebar-text)] transition-colors hover:bg-white/10";

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 5L6.5 10l5 5M15.5 5v10" />
    </svg>
  );
}

/**
 * The dashboard frame: the sidebar and the content card.
 *
 * On a wide screen the sidebar stays in view while the page scrolls, and can be collapsed
 * to a narrow rail. On a phone it is a drawer opened from a top bar. `--dash-offset` is the
 * height taken by everything around the content; a page that must fit the viewport sizes
 * itself as `calc(100dvh - var(--dash-offset))`.
 */
export function DashboardShell({
  sidebar,
  children,
}: {
  /** The links and the account block, rendered on the server. */
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    // Phone: the top bar (3rem), the outer padding (1rem) and the card's padding (1.5rem).
    // Wide: the outer padding (1.5rem) and the card's padding (2rem). Both add the card's border.
    <div className="min-h-dvh bg-[var(--bg-page)] [--dash-offset:calc(5.5rem+2px)] lg:[--dash-offset:calc(3.5rem+2px)]">
      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-[var(--bg-sidebar)] px-3 text-[var(--bg-sidebar-text)] lg:hidden">
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="dashboard-sidebar"
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon />
        </button>
        <p className="text-sm font-semibold tracking-wide">ByTheBook</p>
      </header>

      {/* Phone backdrop */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div
        className={`mx-auto grid max-w-[1600px] gap-3 p-2 lg:p-3 ${
          collapsed ? "lg:grid-cols-[3.25rem_minmax(0,1fr)]" : "lg:grid-cols-[200px_minmax(0,1fr)]"
        }`}
      >
        {/* Collapsed rail (wide screens) */}
        {collapsed && (
          <div className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] justify-center rounded-[2rem] bg-[var(--bg-sidebar)] py-4 lg:flex">
            <button
              type="button"
              className={iconButtonClass}
              aria-label="Show menu"
              aria-expanded={false}
              aria-controls="dashboard-sidebar"
              onClick={() => setCollapsed(false)}
            >
              <MenuIcon />
            </button>
          </div>
        )}

        <aside
          id="dashboard-sidebar"
          className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col overflow-y-auto rounded-r-[2rem] bg-[var(--bg-sidebar)] px-4 py-5 text-[var(--bg-sidebar-text)] transition-[transform,visibility] duration-200 ${
            drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
          } lg:visible lg:sticky lg:inset-auto lg:top-3 lg:z-auto lg:h-[calc(100dvh-1.5rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-[2rem] lg:transition-none ${
            collapsed ? "lg:hidden" : ""
          }`}
          // Following a link closes the drawer; the link itself still navigates.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDrawerOpen(false);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--bg-sidebar-muted)]">
                ByTheBook
              </p>
              <h2 className="mt-2 text-xl font-semibold">Dashboard</h2>
            </div>
            <button
              type="button"
              className={`${iconButtonClass} lg:hidden`}
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <CloseIcon />
            </button>
            <button
              type="button"
              className={`${iconButtonClass} hidden lg:flex`}
              aria-label="Hide menu"
              title="Hide menu"
              onClick={() => setCollapsed(true)}
            >
              <CollapseIcon />
            </button>
          </div>
          {sidebar}
        </aside>

        <div className="min-w-0 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-3 shadow-sm lg:rounded-[2rem] lg:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
