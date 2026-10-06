# Dashboard frame, Overview and Visualizations pages

**Status:** Live
**Files:** `src/app/dashboard/layout.tsx` (the frame and Sign out),
`src/components/layout/DashboardShell.tsx`, `src/components/overview/OverviewShowcase.tsx`,
`src/app/dashboard/visualizations/page.tsx`, `src/components/ui/RouteCard.tsx`,
`src/lib/auth/access.ts` (what the sidebar and both pages list), `src/app/globals.css` (theme
tokens), `src/context/BackgroundMode.tsx` (the background setting)

The rules for these pieces are under "UI" and "Guests and accounts" in `AGENTS.md`. This doc
covers how they work. The decisions behind them are `plans/deployment.md` D16–D20.

## The frame

- **`DashboardShell` frames every dashboard page.** On a wide screen the sidebar stays in
  view while the page scrolls and can collapse to a rail; on a phone it is a drawer opened
  from a top bar.
- **It sets `--dash-offset`,** the height of everything around the content (padding, the
  card's border and, on a phone, the top bar), which board pages subtract from `100dvh`.
- **The sidebar lists `NAV_ITEMS`** for the viewer, with sign-in links for a guest and Sign
  out for a user.
- **Debug mode adds "Copy bug report"** (`BugReportButton`) above the account block, for the
  viewers `canDebug` (`src/lib/auth/debug.ts`) allows: everyone under `next dev` when
  `DEBUG_MODE=true`, and deployed, only the accounts whose email is on `DEBUG_EMAILS`. It copies
  `formatBugReport`'s text: the address, time, window size, background mode, guest or signed
  in, the browser, and a section from each page that adds one through `useBugReportSection`
  (`src/context/BugReport.tsx`). `BugReportProvider` wraps the whole frame, so the sidebar's
  button can read the page beside it.

## Overview

The Overview is the info page that a landing page would otherwise be (`/` redirects to
`/dashboard`).

- **Page tabs beside one demo window, as one group** (`OverviewShowcase`). The window cycles
  through the pages by `DEMO_ROTATE_MS` and waits while the pointer or keyboard focus is
  inside the group.
- **Pointing at a tab only highlights it.** The first press shows its demo and stops the
  cycling; a second press, or a press on its "Jump to page" tag, opens the page. Mouse,
  touch and keyboard all work this way. On a phone the tabs are a row of chips.
- **The description writes itself out a word at a time** (`.stream-word` in `globals.css`,
  paced by `STREAM_WORD_MS`).
- **The window shows a placeholder** until the demo animations exist (deployment Phase 7).
- **The guest and account table** comes from `ACCESS_ROWS`.

## Visualizations page

A route button (`RouteCard`, tagged "Jump to page") for each entry in `VISUALIZATIONS`: the
live Treemap first, then the prototypes under "Possible future visualizations". A guest sees
the prototypes listed but can't open them.

## Theme colors

- **Background modes** come from `BackgroundMode` and are saved in the browser, for guests and
  accounts alike.
- **Buttons use the theme tokens** `btn-primary`, `btn-secondary` and `btn-ghost`, so their
  text stays readable in every mode.
- **The link reset in `globals.css` sits in the base layer.** Outside a layer it overrode
  every text-color utility on a link, which made links styled as dark buttons unreadable.
