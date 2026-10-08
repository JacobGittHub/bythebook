# Dashboard frame, Overview, Visualizations, Library and Bookstore pages

**Status:** Live
**Files:** `src/app/dashboard/layout.tsx` (the frame and Sign out),
`src/components/layout/DashboardShell.tsx`, `src/components/overview/OverviewShowcase.tsx`,
`src/app/dashboard/visualizations/page.tsx`, `src/components/ui/RouteCard.tsx`,
`src/components/books/BookViewPage.tsx` (the small visualizations), `src/components/library/`
(the Library and the Bookstore), `src/lib/auth/access.ts` (what the sidebar and both pages
list), `src/app/globals.css` (theme tokens), `src/context/BackgroundMode.tsx` (the background
setting)

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
`featured` entry first, in a larger card (the Labyrinth, while it is in active development),
then the live Treemap, the `small` visualizations as their own group, and the prototypes
under "Possible future visualizations". A guest sees the account-only entries listed but
can't open them.

**Small visualizations** are the five book views (`explorer.md`, "Book views"), one page each
at `/dashboard/visualizations/books/<view>` (`BookViewPage`). Guests can open them. A page
draws one book beside a board: an example book (`src/lib/books/examples.ts`), or one of the
viewer's own books, from their library. The rail switches views without leaving the page and
keeps the book, and the address follows (`?book=`), so a link reopens the same book. The
panel shows the selected or hovered position, what a store card will say about the book
(positions against `MAX_BOOK_POSITIONS`, lines, average line, clashes, the unconnected flag,
from `src/lib/books/measures.ts`), and, for an example book, how it was made and whom it
credits.

**Example books** are static files in `public/books/examples/`, written by
`npm run books:examples` (`scripts/buildExampleBooks.ts`) and served by the CDN, so showing
one costs no function call. Each file names its method (Wikibooks page titles, the catalog's
named lines, master statistics from `position_cache`, or the catalog grown from master
statistics) and, for Wikibooks, its CC BY-SA credit, which the page shows.

## Library page

The viewer's books, from the library (`useLibrary`, `src/context/Library.tsx`): a guest's
are kept in this browser and a signed-in viewer's in the account, and the page names which
(`STORE_LABELS`), so the two are never confused (`plans/deployment.md` D23). It has two
levels (D21), drawn first in `docs/design/mockups/library.html` (mockup A); the parts are in
`src/components/library/`.

- **Level 1** (`LibraryPage.tsx`, `/dashboard/library`) is the book list beside the selected
  book. The list (`BookList.tsx`) reads only the summaries: each row has its book's icicle in
  miniature (`BookMiniature`, from `summary.miniature`), and a search and an All, White or
  Black filter (`filterBooks`, `src/lib/library/search.ts`) narrow it. The selected book is
  in the address (`?book=`, written with `history.pushState`, so it costs no request); wide,
  the first book shows when none is named, and on a phone the list and the book take turns,
  with Back between them. The book (`BookDetail.tsx`) shows its tags, origin and credit,
  measures (`BookMeasures`), Open book page, Open in Explorer, Train, the "⋯" menu, and the
  book itself (`BookReader`).
- **Level 2** (`LibraryBookPage.tsx`, `/dashboard/library/<id>`) is a book's own page: the
  same with a bigger view, the five views as buttons, and a panel for where it came from
  (`OriginPanel`), which links a store book back to its Bookstore page. Success rates,
  difficulty and leaderboards join it with the trainer and game history.
- **`BookReader`** draws one book view with zoom (`ZoomControls`, `explorer.md`) beside a
  board for the selected or hovered position (`SelectedPosition`, `useBookSelection`). It
  opens in the icicle, down the main line, and on a phone puts the board first. Until the
  views draw several trees, it shows the tree from the starting position (`startTree`).
- **Editing** (D25): the "⋯" menu (`BookMenu.tsx`) renames, changes side, duplicates
  (`duplicateBook`) and deletes, and Remove move (`RemoveMoveButton.tsx`) removes the
  selected move with everything after it once the user has seen how much goes. Each saves
  against the time the book was read, so a change made in another tab is reported
  (`STALE_BOOK_MESSAGE`) instead of overwritten (`saveBook`, `src/lib/library/trees.ts`).
- **New book** (`NewBookDialog.tsx`) takes a name, a side and where the first lines come
  from. "Add lines in the Explorer" is recommended: the Explorer opens with the book chosen
  (`explorerHref`, `src/lib/library/links.ts`). "Paste moves or PGN" reads the paste with
  `readPgn` (`src/lib/library/pgn.ts`), which replays every move, makes each bracketed
  variation its own line, and names the first illegal move.
- **Back up** downloads every book as the version 1 file (`src/lib/library/backup.ts`).
  **Restore** reads one into the checklist (`CopyChecklist`, `src/lib/library/copyPlan.ts`),
  which lists what happens to each book, and lets a book whose name is taken be kept as a
  second book or skipped.
- **The empty state** (`LibraryEmpty.tsx`) offers New book, Restore, and the Bookstore's books
  with Save. A saved store book records `EXAMPLE_PUBLISHER` and its credit (D24), and a name
  over the limit is cut to fit (`fitBookName`).
- **Feedback** goes to toasts (sonner's `Toaster`, in the dashboard layout), and anything that
  can't be undone asks first in an alert dialog.
- **The backup notice** (`backupAdvice`, `src/lib/library/backup.ts`) shows a guest when
  the library was last backed up and why that matters, whenever the browser hasn't promised
  to keep the data (`browserKeepsData`) or a book changed since the last backup
  (`plans/bookstore.md` D12).
- **Books in the browser at sign-in** (`BrowserBooksOffer.tsx`, D22). When a signed-in
  viewer's browser still holds books, a notice on every other dashboard page links here,
  where the checklist copies them into the account and each copied book leaves the
  browser. "Not now" lasts for the tab's session, after which one line offers the copy
  again; a book that wasn't copied is offered again next session.
- **Debug mode** adds a panel with the browser library's book count, "Back up browser
  library" and "Empty browser library", for guests and accounts alike (D23), and the bug
  report gains a Library section: the store, its book count and, signed in, the books
  still in the browser.
- Game history keeps a "coming soon" line under the list.

## Bookstore

Ready-made books (`plans/bookstore.md`), drawn first in `docs/design/mockups/bookstore.html`.
Until the store has its own tables (bookstore Phases 3–4), its books are the example books,
ByTheBook's store books (`plans/deployment.md` D24), which `useStoreBooks` reads once from
their static files and summarizes in the browser. There are no ratings or saves yet, so none
are shown, and the cards sort by name. Guests use both levels (bookstore D14).

- **Level 1** (`BookstorePage.tsx`, `/dashboard/bookstore`) is a card per book: its
  miniature, title, publisher, a line of description, side, positions against the limit,
  lines, the unconnected flag and the credit, with search, side and Verified only.
- **Level 2** (`StoreBookPage.tsx`, `/dashboard/bookstore/<slug>`, the example id without
  its prefix, `storeBookHref`) has the full description, measures, `BookReader`, how the book
  was made and its credit, and Save to library, which becomes "In your library" with a link
  once the library has a copy (`origin.sourceId`).
- **The publisher label** (`PublisherLabel`) puts Verified or Unverified beside the name's
  highlight, never inside it (bookstore D8). Until publishers have accounts, a store book is
  verified when it is an example book (`storeVerified`).

## Theme colors

- **Background modes** come from `BackgroundMode` and are saved in the browser, for guests and
  accounts alike.
- **shadcn/ui** (`plans/vibes.md` D12) supplies the Library's and the Bookstore's controls,
  from `src/components/shadcn/` (`components.json`). Its color names (`--background`,
  `--card`, `--primary`, `--muted`, `--border` and the rest) point at the background-mode
  tokens in `globals.css`, so every mode restyles them, and only `--destructive` is new. A
  bare `border` takes the theme's border color. Tailwind's radius scale isn't remapped.
- **Buttons outside the Library and Bookstore use the theme tokens** `btn-primary`,
  `btn-secondary` and `btn-ghost`, so their text stays readable in every mode.
- **The link reset in `globals.css` sits in the base layer.** Outside a layer it overrode
  every text-color utility on a link, which made links styled as dark buttons unreadable.
