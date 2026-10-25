# Dashboard frame, Overview, Visualizations, Library, Bookstore and Settings pages

**Status:** Live
**Files:** `src/app/dashboard/layout.tsx` (the frame), `src/app/dashboard/actions.ts` (Sign out),
`src/components/book/` (the book frame, its parts and its turns), `src/lib/book/` (the book's
layout and turns),
`src/components/overview/OverviewSpread.tsx`,
`src/components/visualizations/` (the Visualizations chapter),
`src/components/books/BookViewPage.tsx` (a book view's own page), `src/components/library/`
(the Library and the Bookstore), `src/lib/auth/access.ts` (what the strip and both pages
list), `src/app/globals.css` (theme tokens), `src/context/Appearance.tsx` and
`src/lib/appearance.ts` (the theme, vibes and motion settings), `src/components/ui/Panel.tsx`,
`src/components/settings/` (the Settings page), `src/components/book/PlaceholderSpread.tsx`
(Train and Puzzles)

The rules for these pieces are under "UI" and "Guests and accounts" in `AGENTS.md`. This doc
covers how they work. The decisions behind them are `plans/deployment.md` D16–D19 and
`plans/vibes.md` D2, D12 and D13.

## The frame

The dashboard is an open book on a desk (`plans/book-ui.md`), drawn first in
`docs/design/mockups/dashboard-spread.html`.

- **`BookFrame` frames every dashboard page:** the walnut desk (`plans/book-ui.md` D20), with
  the strip over its top (the
  brand, a tab per `NAV_ITEMS` entry the viewer may open, the vibes switch and the account
  links) or, in the one-page form, the chapter column beside it. Windows narrower than
  `SPREAD_MIN_WIDTH` get the one-page form (`formFor`). Its column shows chapter names, or
  icons below `CHAPTER_NAMES_MIN_WIDTH` (`chaptersFor`); a button in its head narrows or widens
  it, and the frame keeps the pick in the `CHAPTERS_COOKIE` cookie. A phone's column shows
  icons only, and its button hides it (D15): the column slides off the desk, the page takes its
  width, and the open chapter's page tab, at the window's left edge, brings it back
  (`.book-chapters-show`). The page's tab reaches onto the page short of its text. Beside
  a name goes "soon" for a page coming soon, or the chapter's figure (`ChapterFigure`): the
  Library's book count.
- **The book is the frame's, and each page renders its pages into it** with `Spread`
  (`src/components/book/Spread.tsx`): its left page and its right page. In the one-page form
  they are the page's two halves, side by side where both fit and stacked where not; stacked,
  `stack` may show the left half alone, as the Library's list does. A page that lays out its
  one-page form itself passes it as `single`, as the Explorer does with its board on top
  (`explorer.md`). The one page that isn't a spread, the trainer's scaffold
  (`/dashboard/train/<id>`), is wrapped in `InterimSpread`, which lays it across both pages.
- **A page below a chapter's own page is its second level** (`levelAt`,
  `src/lib/book/chapters.ts`), such as a Bookstore book's page. Unless its chapter is listed in
  `WHOLE_SPREAD_CHAPTERS` (`zoomsAt`), in the spread a camera zooms in
  on it (`zoomCamera`, `src/lib/book/camera.ts`): the right page fills the window but for
  `ZOOM_SHOWN` of the left page at its left edge, and the book runs on past its bottom. The
  frame sets the camera as the book's transform; the book itself keeps its layout. The camera
  moves the desk's grain too (`.book-desk-grain`, `plans/book-ui.md` D20), so the desk zooms
  and scrolls with the book. A second
  level's pages are laid out for the zoomed view (`.book-zoomed`): the whole page at the
  window's own pixels, set onto the page that much smaller, so it reads at the usual size; the
  left page's content stands against the spine (`.book-shown`). The right page's body is its
  first screen (`.book-fold`), down to where the window's bottom cuts the page (`shownHeight`),
  and what the page holds `below` follows it, with its top in sight.
- **A second level's view scrolls down the book** to the zoomed cover's bottom (`zoomReach`):
  the desk scrolls, over a room as tall as that (`.book-scroll-room`), with its scrollbar
  hidden, since it would take its width from the book, and a thumb of the frame's
  (`.book-scroll-thumb`) in its place. The strip has no wood of its own, so the desk's
  shows through it; it goes up with the desk as the view scrolls down, until it is above the
  window, and comes back down with it. It drops down over the book, as a board of the desk's
  wood where the camera would show it, while the mouse is at the window's top edge or
  on the strip, while the keyboard is in it, and on a touch screen once the view scrolls up,
  and slides back up after (`useStrip` in `BookFrame`). Each page's view starts at the top,
  another book's too.
- **An interim second level,** the trainer's scaffold, puts its content on the right page and a
  way back on the left. The one-page form has no camera: a second level shows only its right page, with the way back
  in its running head and what it holds below after its body.
- **A whole spread's second level** (`WHOLE_SPREAD_CHAPTERS`), every second level of the
  Library (the game history and the books' pages), turns down from its chapter as any second
  level does but isn't zoomed in on: its pages are laid out as a first level's, with its own way
  back in the left page's running head, and the one-page form stacks both halves (an exception
  to `plans/book-ui.md` D8, from `plans/game-history.md` D30 and D40).
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
  button can read the page beside it. The frame adds a "Page turns" section (`useTurnLog`,
  `turnLogSection` in `src/lib/debug/turnLog.ts`): whether the browser has view transitions,
  and for the last `TURN_LOG_LENGTH` moves which way each went, which animations ran, whether
  the browser finished or skipped it, and its frames, for a phone's Safari, whose console
  can't be read. Over plain http, as from a phone on the local network, the browser has no
  clipboard API, so the button copies with the older copy command.
- **The sign-in pages** (`src/app/auth/layout.tsx`) are outside the book, one panel on the
  backdrop, which is painted as the walnut desk. Laying a book there was put off
  (`plans/book-ui.md` Phase 3).

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
- **The camera moves with a second level's turn** (`moveTiming`): zooming in, the turn goes
  first, so the whole new page shows before the camera moves in, and the camera starts
  `ZOOM_OVERLAP` of the way into it; zooming out, the camera goes first, from where the view
  had scrolled to (`scrolledBy`). The live book is at the new camera from the start; each picture, the book's own (`book`)
  and the desk's (`desk`) included, is moved on its own as the browser takes it (`onPicture` in `BookFrame`,
  `moveWithCamera` in `src/components/book/camera.ts`, `pictureMove`), because not every browser
  moves a picture with its live page. The strip is a picture over the desk and the book but
  under the leaves, so a leaf that rises past the desk's top passes over it whole; dropped down
  over the book as the move starts, it stays on top until it changes halfway
  (`data-strip-over`). The timings are constants in `turns.ts`, which
  `bookFrameCss` writes for `turns.css`.
- **A jump of several chapters riffles** up to `MAX_RIFFLES` blank leaves between, each carrying
  its chapter's bookmark or page tab (`riffleBookmarkX` mirrors a bookmark onto a leaf that
  starts on the other side of the spine). They lie under the pages, where only the turn's
  pictures show them, and the frame takes them away once no turn is running.
- **An interim page's content spans the spine,** so in a turn it stays on the pages that lie
  still and the turning leaves are blank.
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

The Visualizations chapter (`plans/book-ui.md` D18) lists `VISUALIZATIONS`
(`src/lib/auth/access.ts`) group by group, in the order of `VISUALIZATION_GROUPS`. Its parts
are in `src/components/visualizations/`.

- **Its own page is a spread** (`VisualizationsSpread`). The left page is the contents: each
  visualization a row with its name, a dotted leader and its figure (small, full page, or
  Account for a guest on one that needs an account). The right page shows the picked one: its
  screenshot, its summary and "Jump to page". Presses work as on the Overview. A guest is
  shown the account-only ones with a sign-in offer in place of the jump. On a short page the
  line under the title goes and the rows tighten (`.visualizations-contents` in
  `globals.css`). `?show=<id>` picks one, as the way back from its page does.
- **The screenshots** are taken from the running app by `npm run demos:shots`
  (`scripts/demos/shootVisualizations.ts`) into `public/visualizations/`, one per theme
  (`visualizationShot`); a book view's is cut about its moves. They stand in for previews
  for now, and a missing one shows a placeholder.
- **Each visualization opens on a page of its own,** the chapter's second level
  (`VisualizationLevel`), which turns and zooms in as a Library book's page does (D8). The
  part of the left page in view lists the visualizations under "Back to all visualizations",
  and another one re-inks the right page. The Labyrinth, the Treemap and the globe prototype
  keep their own page frames on the right page.

**Small visualizations** are the five book views (`explorer.md`, "Book views"), one page each
at `/dashboard/visualizations/books/<view>` (`BookViewPage`), laid out as a Library book's
page. Its first screen is the view's name and summary, the book picker, and the book in that
view beside a board (`BookReader`, its view fixed); below are the book's measures
(`BookMeasures`) and, for an example book, how it was made and whom it credits. Guests can
open them. A page draws an example book (`src/lib/books/examples.ts`) or one of the viewer's
own, from their library. The list's other book views keep the book, and the address follows
it (`?book=`), so a link reopens the same book; on one page, where the list isn't shown, a
View menu switches.

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

- **Level 1** (`LibraryPage.tsx`, `/dashboard/library`) is a spread (`plans/book-ui.md` D8).
  The left page is "Your books": New book, Back up and Restore, the notices below, and the
  list (`BookList.tsx`), which reads only the summaries. Its rows (`BookRows`) are contents
  lines, the side, the name, a dotted leader and the book's positions, and a search and an
  All, White or Black filter (`filterBooks`, `src/lib/library/search.ts`) narrow it. The
  folios count the books and their positions. The right page is the picked book
  (`BookDetail.tsx`): its tags, origin and credit, measures (`BookMeasures`), Open book page,
  Open in Explorer, Train, the "⋯" menu, and the book in a view that fills the page, without
  the board. Picking a book re-inks the right page; the pick is kept in the address (`?book=`,
  written with `history.replaceState`, so it costs no request), which the route reads on the
  server, since a Suspense boundary around the page would start the turn without it. The first
  book shows when none is named. Where the one-page form stacks the halves, on a phone, the
  picked book doesn't show and a row is a link to the book's own page.
- **Level 2** (`LibraryBookPage.tsx`, `/dashboard/library/<id>`) is a book's own page on a whole
  spread (`plans/game-history.md` D40, `plans/mockups/book-spread.html`'s layout A). The left
  page's head has "Back to all books", which returns with the book picked (`libraryHref`);
  another book is chosen there. Below the title come its tags, its origin and credit
  (`OriginLine`, with the way to a store book's page), Open in Explorer, Train and the "⋯" menu,
  then the facts (`BookFacts`): the measured difficulty (`measuredDifficulty`) as a dot on a
  scale of `--difficulty-*` steps whose number shows on hover, the moves to remember
  (`countOwnMoves`) and the average line, then positions, lines and Clashes. Clashes opens
  `ClashesDialog` and is flagged while any clash is left to resolve. Then Plain, Your games or
  Drills (soon), and a list that fills the rest of the page: the book's contents
  (`bookContents`, each opening it names in tree order), or with Your games the totals and
  where the user's games leave the book (`compareWithBook`), chosen by `BookGamesFilter`'s span
  (3 months, 12 months or all time, `recentGames`) and the history page's time and source boxes.
  The page opens on Your games when the user has games. The right page is the current position
  (`BookPosition`: the board with the highlighted or hovered move's arrow, Remove move, Open in
  Explorer, the user's results, and boxes of fixed height for the next moves, unticked ones
  tagged "not drilled", and where games left the book there), then the view picker, zoom and
  the book in its view, walked with the arrow keys from anywhere on the page and, with Your
  games, painted by score (`success`) and as thick as its games (`thickness`). The folios give
  the book's place in the Library, the credit in short (`originFolio`) and the positions
  against the limit.
- **The clashes dialog** (`ClashesDialog.tsx`, D40) lists the book's clashes, to resolve or
  all, each with its state (`clashesOf`, `src/lib/books/drills.ts`). For the chosen one it shows
  the board with an arrow for each ticked move, "Keep only the most played" and "Tick all", and a
  box per move with its lines and, with games, the user's games, results and score. One move
  always stays ticked. "Keep the most played move at every clash" picks by the user's games,
  then by lines (`mostPlayed`). Changes are a draft until Save choices, which writes the
  unticked moves' `skip` flags into the book (`withPicks`) and saves it like any edit.
- **The game history page** (`GameHistoryPage.tsx`, `/dashboard/library/history`,
  `plans/game-history.md` D30, D38) is a whole spread, reached by Open game history. The left
  page is "Your games": the side (Both, White or Black), the time controls and the sources with
  their imports as buttons that open check boxes (`HistoryFilters`, `src/lib/history/historyFilter.ts`),
  a strip of games per month to drag a span across, "All games" to choose everything again, the
  page opening on the last `RECENT_MONTHS` months up to the newest game (`recentGames`), the
  totals, and the games through the current position, newest first, each with its next moves
  and a link to its site. The right page is the current position (`HistoryPosition`): the
  board with an arrow for the highlighted (or hovered) move, the opening
  (`getOpeningForLine`), "Open in Explorer", the user's results and the moves played next in a
  box of fixed height that scrolls to keep the highlighted move in view, each named where it
  starts an opening; under it the games' tree (`buildHistoryTree`, `src/lib/history/historyTree.ts`) in
  ply columns, weighted by games and painted by the user's score under the "Your score"
  switch. The games are read in the browser (`useHistoryGames`), and each filter builds the
  tree again from them.
- **`BookReader`** draws one book view with zoom (`ZoomControls`, `explorer.md`) beside a
  board for the selected or hovered position (`SelectedPosition`, `useBookSelection`), or
  without it. On a page of the book it takes the height it is given (`fill`), and the board's
  column scrolls on its own. It opens down the main line in `DEFAULT_READER_VIEW`, the icicle
  where a book is previewed small and ply columns on a book's own page
  (`plans/game-history.md` D31), and on a phone puts the board first. Until the views draw several trees, it shows the tree from the starting
  position (`startTree`).
- **Editing** (D25): the "⋯" menu (`BookMenu.tsx`) renames, changes side, duplicates
  (`duplicateBook`) and deletes, and Remove move (`RemoveMoveButton.tsx`) removes the
  selected move with everything after it once the user has seen how much goes. Each saves
  against the time the book was read, so a change made in another tab is reported
  (`STALE_BOOK_MESSAGE`) instead of overwritten (`saveBook`, `src/lib/library/trees.ts`).
- **New book** (`NewBookDialog.tsx`) takes a name, a side and where the first lines come
  from. "Add lines in the Explorer" is recommended: the Explorer opens with the book chosen
  (`explorerHref`, `src/lib/library/links.ts`). "Paste moves or PGN" reads the paste with
  `readPgn` (`src/lib/library/pgn.ts`), which replays every move, makes each bracketed
  variation its own line, and names the first illegal move. It reads with the PGN tokenizer
  that the game history import shares (`src/lib/chess/pgnTokens.ts`).
- **Back up** downloads every book as the version 1 file (`src/lib/library/backup.ts`), through
  `useBackup` (`src/components/library/useBackup.ts`), which the Settings page shares.
  **Restore** reads one into the checklist (`CopyChecklist`, `src/lib/library/copyPlan.ts`),
  which lists what happens to each book, and lets a book whose name is taken be kept as a
  second book or skipped.
- **The empty state** (`LibraryEmpty.tsx`) offers New book and Restore on the left page, and
  the Bookstore's books with Save on the right (`StoreOffer`). A saved store book records `EXAMPLE_PUBLISHER` and its credit (D24), and a name
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
  again; a book that wasn't copied is offered again next session. `useBrowserBooksCopy` gives
  the two parts: the checklist takes the right page while it is open, as Restore's does, and
  the line sits under the left page's header with the backup notice.
- **Debug mode** adds a panel at the foot of the left page with the browser library's book count, "Back up browser
  library" and "Empty browser library", for guests and accounts alike (D23), and the bug
  report gains a Library section: the store, its book count and, signed in, the books
  still in the browser.
- **Game history** (`GameHistorySection.tsx`, `plans/game-history.md` D29) is fixed at the
  foot of the left page, under the book list, which scrolls alone. It shows how many games are
  kept, Open game history and Import games, which opens `GameImportDialog`: a PGN file or pasted text, the file's
  check with the player's name, and the choice when the games don't fit the limit. Once the
  import starts, the dialog closes, and the progress, then the report, take the section's place;
  the report keeps Open game history and closes with its Close button.
  The import runs in `GameImportProvider` (`src/context/GameImport.tsx`), in the dashboard
  layout, so it carries on across pages. A viewer elsewhere when it ends gets a toast with a
  close button and the way back here, and the browser asks before a tab with an import running
  closes. A guest's games stay in the browser and an account's in the database. The section's
  menu deletes every game, after asking, and an account whose games don't fit can ask for more
  room from the dialog.

## Bookstore

Ready-made books (`plans/bookstore.md`), drawn first in `docs/design/mockups/bookstore.html`.
Until the store has its own tables (bookstore Phases 3–4), its books are the example books,
ByTheBook's store books (`plans/deployment.md` D24), which `useStoreBooks` reads once from
their static files and summarizes in the browser. There are no ratings or saves yet, so none
are shown, and the cards sort by name. Guests use both levels (bookstore D14).

- **Level 1** (`BookstorePage.tsx`, `/dashboard/bookstore`) is a spread
  (`plans/book-ui.md` D9): search, side and Verified only on the left page, and on the right
  the shelf they leave, a card per book in two columns where the page has room: its miniature,
  title, publisher, side, positions against the limit, lines and the unconnected flag. There
  are no shelves beyond what the filters make until the store has its back end. The filters
  are kept in the address (`?q=&side=&verified=`, `parseShelf` and `shelfQuery` in
  `src/lib/library/search.ts`), written with `history.replaceState` and read by the route on
  the server, as the Library's picked book is.
- **Level 2** (`StoreBookPage.tsx`, `/dashboard/bookstore/<slug>`, the example id without
  its prefix, `storeBookHref`) is zoomed in on as the Library's is. A card's address carries
  the filters, so the part of the left page in view lists the shelf as they left it
  (`BookRows`), under "Back to the shelf" (`bookstoreHref`), which keeps them; another book
  re-inks the right page. The right page's first screen has the name, the publisher, the full
  description, Save to library, which becomes "In your library" with a link once the library
  has a copy (`origin.sourceId`), and `BookReader`; below it, "About this book" has the
  measures, how the book was made and its credit.
- **The publisher label** (`PublisherLabel`) puts Verified or Unverified beside the name's
  highlight, never inside it (bookstore D8). Until publishers have accounts, a store book is
  verified when it is an example book (`storeVerified`).

## Settings, Train and Puzzles

- **Settings is a spread** (`SettingsSpread`, `plans/book-ui.md` D10). The left page is
  Appearance, a `SettingRow` each for the theme, vibes, page turns and music (to come with
  vibes), in `AppearancePanel`; then "About this book": the deployment notes, the thanks to
  Lichess and the developer's message (`DEVELOPER_MESSAGE`, shown once it is written).
- **The right page is your data and account:** where your books are kept and how many, the
  backup notice for a browser library, Back up, and a way to the Library page to restore
  (restoring needs its checklist, which is the Library's); then Sign in and Create account, or
  the account's name and Sign out; and in debug mode "Copy bug report".
- **Train and Puzzles are placeholders** (`PlaceholderSpread`, D11): the chapter's title page
  on the left, and on the right what it will be, marked coming soon. A book's Train button
  still opens the trainer's scaffold (`/dashboard/train/<id>`).

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
  `--turn-shade`, `--bookmark`, `plans/book-ui.md` D2, D3), the walnut desk's (D20: `--desk`
  and `--desk-low` under a grain drawn by `scripts/renderDeskGrain.ts`, all laid by
  `--desk-paint`; the spread lays the shade, `--desk-shade`, on the window and the grain on a
  layer of the desk's that the camera moves, and `--desk-foreground`, `--desk-muted`, `--desk-line`, `--desk-hover` and
  `--desk-mark` for what lies on it; the strip and the chapter column set shadcn/ui's names
  from these, and the desk is the same under every vibe) and shadcn/ui's names
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
- **A spread's parts lie on the page with no boxes around them.** A page that keeps a frame
  of its own on the right page (the Labyrinth, the Treemap, the trainer's scaffold) or lies
  outside the book (the sign-in pages) holds its content in a `Panel`, with a `PanelLabel` for
  its small heading. It carries
  `data-slot="panel"`, as the sign-in pages' backdrop carries `backdrop` and the move bars
  `move-bar`, beside shadcn/ui's own slots, and their `::before` and `::after` are left for a
  vibe's ornaments.
- **The book's parts** (`src/components/book/Book.tsx`) carry the book's vibe areas: `book`,
  `cover`, `page`, `page-edge`, `gutter`, `running-head`, `folio` and `margin`
  (`plans/vibes.md` D14).
- **The link reset in `globals.css` sits in the base layer.** Outside a layer it overrode
  every text-color utility on a link, which made links styled as dark buttons unreadable.
