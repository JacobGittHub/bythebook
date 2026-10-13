"use client";

import { useState, type ReactNode } from "react";

const iconButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent";

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
 * The dashboard frame: the backdrop, the sidebar and the frame around the page.
 *
 * On a wide screen the sidebar stays in view while the page scrolls, and can be collapsed
 * to a narrow rail. On a phone it is a drawer opened from a top bar. `--dash-offset` is the
 * height taken by everything around the content; a page that must fit the viewport sizes
 * itself as `calc(100dvh - var(--dash-offset))`.
 *
 * The backdrop, the sidebar (with the phone's top bar) and the frame are vibe areas
 * (plans/vibes.md D13), marked with `data-slot` for globals.css § "Vibe areas".
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
    // Phone: the top bar (3rem), the outer padding (1rem) and the frame's padding (1rem).
    // Wide: the outer padding (1.5rem) and the frame's padding (1.5rem). Both add the frame's border.
    <div className="relative isolate min-h-dvh [--dash-offset:calc(5rem+2px)] lg:[--dash-offset:calc(3rem+2px)]">
      {/* Behind everything: the page's color, and later a vibe's scenery. */}
      <div
        data-slot="backdrop"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-background"
      />

      {/* Phone top bar */}
      <header
        data-slot="topbar"
        className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-sidebar px-3 text-sidebar-foreground lg:hidden"
      >
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
        <p className="font-heading text-sm font-semibold tracking-wide">ByTheBook</p>
      </header>

      {/* Phone backdrop */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div
        className={`mx-auto grid max-w-[1600px] gap-2 p-2 lg:gap-3 lg:p-3 ${
          collapsed ? "lg:grid-cols-[3rem_minmax(0,1fr)]" : "lg:grid-cols-[200px_minmax(0,1fr)]"
        }`}
      >
        {/* Collapsed rail (wide screens) */}
        {collapsed && (
          <div
            data-slot="sidebar"
            data-collapsed=""
            className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] justify-center rounded-lg bg-sidebar py-3 lg:flex"
          >
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
          data-slot="sidebar"
          className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col overflow-y-auto rounded-r-lg bg-sidebar px-3 py-4 text-sidebar-foreground transition-[transform,visibility] duration-200 ${
            drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
          } lg:visible lg:sticky lg:inset-auto lg:top-3 lg:z-auto lg:h-[calc(100dvh-1.5rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-lg lg:transition-none ${
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
            <div className="px-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-sidebar-muted-foreground">
                ByTheBook
              </p>
              <h2 className="mt-1 font-heading text-lg font-semibold">Dashboard</h2>
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

        <div data-slot="frame" className="min-w-0 rounded-lg border bg-card p-2 lg:p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
