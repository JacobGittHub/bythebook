# Dashboard frame, Overview, Visualizations, Library and Bookstore pages

**Status:** Live
**Files:** `src/app/dashboard/layout.tsx` (the frame and Sign out),
`src/components/book/` (the book frame, its parts and its turns), `src/lib/book/` (the book's
layout and turns),
`src/components/overview/OverviewSpread.tsx`,
`src/app/dashboard/visualizations/page.tsx`, `src/components/ui/RouteCard.tsx`,
`src/components/books/BookViewPage.tsx` (the small visualizations), `src/components/library/`
(the Library and the Bookstore), `src/lib/auth/access.ts` (what the strip and both pages
list), `src/app/globals.css` (theme tokens), `src/context/Appearance.tsx` and
`src/lib/appearance.ts` (the theme, vibes and motion settings), `src/components/ui/Panel.tsx`,
`src/components/settings/AppearancePanel.tsx`

The rules for these pieces are under "UI" and "Guests and accounts" in `AGENTS.md`. This doc
covers how they work. The decisions behind them are `plans/deployment.md` D16–D19 and
`plans/vibes.md` D2, D12 and D13.

## The frame

The dashboard is an open book on a desk (`plans/book-ui.md`, which is being built; its
Phase 4 rewrites this section).

- **`BookFrame` frames every dashboard page:** the desk, with the strip above it (the brand,
  a tab per `NAV_ITEMS` entry the viewer may open, the vibes switch and the account links) or,
  in the one-page form, the chapter column beside it. Windows narrower than
  `SPREAD_MIN_WIDTH` get the one-page form (`formFor`). Its column shows chapter names, or
  icons below `CHAPTER_NAMES_MIN_WIDTH` (`chaptersFor`); a button in its head narrows or widens
  it, and the frame keeps the pick in the `CHAPTERS_COOKIE` cookie. A phone's column shows
  icons only, with no button. The page's tab reaches onto the page short of its text.
- **The book is the frame's, and each page renders its pages into it** with `Spread`
  (`src/components/book/Spread.tsx`): its left page and its right page. A page that isn't a
  spread yet is wrapped in `InterimSpread`, which lays it across both pages.
- **A page below a chapter's own page is its second level** (`levelAt`,
  `src/lib/book/chapters.ts`), such as a Library book's page. In the spread a camera zooms in
  on it (`zoomCamera`, `src/lib/book/camera.ts`): the right page fills the window but for
  `ZOOM_SHOWN` of the left page at its left edge, and the book runs on past its bottom. The
  frame sets the camera as the book's transform; the book itself keeps its layout. A second
  level's pages are laid out for the zoomed view (`.book-zoomed`): at the window's own pixels,
  as tall as the page shows (`shownHeight`), and set onto the page that much smaller, so they
  read at the usual size; the left page's content stands against the spine (`.book-shown`).
  An interim second level puts its content on the right page and a way back on the left. The
  one-page form has no camera: a second level shows only its right page, with the way back in
  its running head.
- **Where everything sits comes from `layoutBook`** (`src/lib/book/layout.ts`), whose property
  tests hold its invariants. The frame draws it with CSS: `bookFrameCss`
  (`src/lib/book/frameCss.ts`) turns the layout's constants into custom properties, so the
  server render is in place before any script runs. Only the bookmarks, which depend on where
  the strip's tabs are, and the page tabs wait for the browser.
- **The server can't see the window,** so it renders the form the last visit had (the
  `FORM_COOKIE` cookie), or the spread; until the script has the right form, a frame of the
  wrong one isn't laid out.
- **A page's body has a definite height,** set by the book, so a page that fits its window
  (the board-page rule in `AGENTS.md` § "UI") is `h-full` in it.
- **Debug mode adds "Copy bug report"** (`BugReportButton`) beside the account links, for the
  viewers `canDebug` (`src/lib/auth/debug.ts`) allows: everyone under `next dev` when
  `DEBUG_MODE=true`, and deployed, only the accounts whose email is on `DEBUG_EMAILS`. It copies
  `formatBugReport`'s text: the address, time, window size, theme and vibes setting, guest or
  signed in, the browser, and a section from each page that adds one through `useBugReportSection`
  (`src/context/BugReport.tsx`). `BugReportProvider` wraps the whole frame, so the strip's
  button can read the page beside it.
- **The sign-in pages** (`src/app/auth/layout.tsx`) are outside the book, one panel on the
  backdrop, until Phase 3 puts them on the desk.

## Moving between pages

A move to another chapter, or down to a second level and back, turns the page
(`plans/book-ui.md` D8, D13, D14), as a view transition.

- **Each page is a picture named after its route** (`PagePicture` in `Spread.tsx`): the left
  page, the right page, the one page, and an interim page's content (its "ink"). Their classes
  say only which page each is and whether it leaves or arrives; `src/components/book/turns.css`
  animates them. React gives a page its enter and exit only when none of the page's own
  elements lies above it, which is why the book is the frame's.
- **The frame works out the move** from the place it was at (`moveBetween`,
  `src/lib/book/turns.ts`) and writes it on `<html>`, the way as `data-turn` and the camera's
  move as `data-zoom`, since a leaving page last rendered before the move. Going down a level
  turns forward and coming up turns back; another page of the same level, such as another
  Library book, doesn't turn. Every link turns, the tabs' and the pages' own; the browser's
  back and forward buttons change pages at once, since Next doesn't run them as transitions.
- **The camera moves with a second level's turn** (`moveTiming`): zooming in, it goes first
  and the turn starts `ZOOM_OVERLAP` of the way into it; zooming out, the turn goes first.
  The live book is at the new camera from the start; each picture, the book's own (`book`)
  included, is moved on its own as the browser takes it (`onPicture` in `BookFrame`,
  `moveWithCamera` in `src/components/book/camera.ts`, `pictureMove`), because not every browser
  moves a picture with its live page. The strip is a picture over the pages, so a leaf that
  rises past the desk's top passes under it. The timings are constants in `turns.ts`, which
  `bookFrameCss` writes for `turns.css`.
- **A jump of several chapters riffles** up to `MAX_RIFFLES` blank leaves between, each carrying
  its chapter's bookmark or page tab (`riffleBookmarkX` mirrors a bookmark onto a leaf that
  starts on the other side of the spine). They lie under the pages, where only the turn's
  pictures show them, and the frame takes them away once no turn is running.
- **An interim page's content spans the spine,** so in a turn it stays on the pages that lie
  still and the turning leaves are blank, until Phase 3 makes each page a spread.
- **The motion setting** (`MOTIONS`: page turn or none) is on the Settings page
  (`AppearancePanel`), saved in the browser like the theme, and written on `<html>` as
  `data-motion`. None, and page turn while the system asks for reduced motion
  (`resolveMotion`), changes pages at once with no transition at all.

## Overview

The Overview is the info page that a landing page would otherwise be (`/` redirects to
`/dashboard`). It is a spread (`OverviewSpread`, `plans/book-ui.md` D10).

- **The left page is the book's contents** (`bookContents` in `src/lib/auth/access.ts`): a
  chapter per row in book order, numbered, with dotted leaders. The Overview itself is front
  matter, not a chapter; `VIBES_CHAPTER` is listed before Settings, coming soon, with no page
  yet. Below the chapters, the guest and account table (`ACCESS_ROWS`) and, for a guest, how
  to get an account. In the spread the contents fit the page (`.overview-contents` in
  `globals.css`): a shorter page drops the chapters' summaries, then the line under the title.
- **The right page shows the picked chapter:** its demo, its description, written out a word
  at a time (`.stream-word`, paced by `STREAM_WORD_MS`), and "Jump to page". It starts on
  the first chapter and changes only when another is picked, which re-inks the page (`Ink`
  in `src/components/book/Book.tsx`).
- **Pointing at a chapter only highlights it.** The first press shows it; a second press, or
  its "Jump to page" tag, opens its page. Mouse, touch and keyboard all work this way. In the
  one-page form the right page's half lies below the contents on a phone, and a press scrolls
  to it.
- **The demo is a looping GIF** named by the chapter's `NAV_ITEMS` entry's `demo` and
  recorded from the running app by `npm run demos:record` (`scripts/demos/recordDemos.ts`)
  into `public/demos/`. A chapter without one shows a placeholder. The demos are first drafts
  (deployment Phase 7).
- **Folios number the chapters as the contents do:** each `Chapter` the frame gets carries
  its `number` in `bookContents`, and `chapterFolio` (`src/components/book/Spread.tsx`) writes
  "Chapter I of VIII", counting the Vibes chapter. The one-page form's chapter column marks a
  page that is coming soon.

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

## Theme and vibe areas

The base UI is ready for vibes (`plans/vibes.md` Phase 1): a vibe will be one stylesheet
block that sets the tokens below and decorates the marked areas.

- **The theme is light, dark or the system's,** picked on the Settings page
  (`AppearancePanel`) beside the vibes switch, and saved in the browser for guests and
  accounts alike (`AppearanceProvider`). `APPEARANCE_SCRIPT` runs in the root layout's
  `<head>` and writes `data-theme` and `data-vibes` on `<html>` before the first paint, so a
  dark page never flashes light. A browser that kept one of the five old background modes
  gets dark for dark and light for the rest (`parseThemeChoice`). The vibes switch is saved
  and written, and no vibe reads it yet.
- **Every color, corner and font is a token** in `globals.css`: the book's paper palette
  (`--desk`, `--page`, `--page-alt`, `--rule`, `--cover`, `--page-edge`, `--gutter`,
  `--turn-shade`, `--bookmark`, `plans/book-ui.md` D2, D3) and shadcn/ui's names
  (`--background`, `--card`, `--muted`, `--border`, `--primary` and the rest), most of which
  are made from the book's, plus the app's own: the move bars'
  (`--bar-white`, `--bar-draw`, `--bar-black`), the board's arrows, `--warning`, `--success`
  and `--overlay`. Code that needs a color string, such as the board's arrows, reads one with
  `useThemeColor`. Every `rounded-*` class is a multiple of `--radius`, and the fonts are
  `font-sans` (Atkinson Hyperlegible), `font-heading` (Literata) and `font-mono` (IBM Plex
  Mono), loaded by the root layout, so a vibe can change all corners or
  faces at once. The book views keep their own `--view-*` and `--fam-*` tokens
  (`plans/vibes.md` D11). `src/lib/theme/contrast.test.ts` checks that every text and
  background pair passes WCAG AA in both themes.
- **Controls are shadcn/ui's,** from `src/components/shadcn/` (`components.json`), on those
  tokens. A bare `border` takes the theme's border color.
- **A box that holds a page's content is a `Panel`,** with a `PanelLabel` for its small
  heading, until the pages are spreads (`plans/book-ui.md` Phase 3). It carries
  `data-slot="panel"`, as the sign-in pages' backdrop carries `backdrop` and the move bars
  `move-bar`, beside shadcn/ui's own slots, and their `::before` and `::after` are left for a
  vibe's ornaments.
- **The book's parts** (`src/components/book/Book.tsx`) carry the book's vibe areas: `book`,
  `cover`, `page`, `page-edge`, `gutter`, `running-head`, `folio` and `margin`
  (`plans/vibes.md` D14).
- **The link reset in `globals.css` sits in the base layer.** Outside a layer it overrode
  every text-color utility on a link, which made links styled as dark buttons unreadable.
