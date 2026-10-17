# Book UI

Status: active · Updated: 2026-10-16 · Depends on: —

**Goal:** rebuild the dashboard as an open book: every page a spread of two pages on a desk,
with page turns, bookmarks that turn with their pages, a one-page form for narrow windows and
phones, and vibes that dress only the book.
**Done when:** every dashboard page is a spread (or one page in the one-page form), the turns
and the second levels' zoom run in current Chrome, Safari and Firefox and change instantly under
reduced motion, a phone gets the one-page form, and the browser tests and docs cover all of
it.

## Decisions

From the user's messages of 2026-10-13 and 2026-10-14, about the mockup
`plans/mockups/dashboard-spread.html` (rounds three to seven, the "Spread Pages" artifact).
Q1–Q9 were answered on 2026-10-14; D4, D8 and D13–D19 hold the answers. D4 and D15 were
amended the same day from the user's notes on round five. Q10 was answered on 2026-10-15,
from `plans/mockups/library-zoom.html` (the "Library Zoom" artifact); D4, D5, D8 and D9 hold
it, replacing the book slide. On 2026-10-16 the user changed D8's order to that artifact's
"Turn, then zoom", with a view that scrolls.

- D1. **The dashboard is an open book on a desk**, the Spread layout of the Paperback
  direction (`plans/mockups/dashboard-paperback.html`). One strip above the book holds the
  brand and the page tabs at the left, and the vibes switch and the account links at the
  right, as in the Paperback mockup's spread. Each page of the book has a running head and a
  folio. The book replaces the sidebar frame (`DashboardShell`) and the boxes inside pages
  (`Panel`). The user chose it because it gives a personal, bookish feel that plain generated
  UIs lack, and because it fits vibes.
- D2. **The look is round four's**: its paper colors, Literata for headings, Atkinson
  Hyperlegible for text, IBM Plex Mono for figures, and shadcn/ui's controls painted with the
  book's tokens (`vibes.md` D12 still holds).
- D3. **The gutter follows the theme.** Light mode has the deep gutter (a crease and a wide
  shadow), dark mode the soft one. Both show stacks of page edges on either side, whose
  thickness says how far into the book the current page is, and a cloth cover behind the
  pages.
- D4. **Each page carries its own bookmark** (round five; its look from round six). It is a
  ribbon folded over the page's top edge, never rising above the page, and it sits level with
  the page's tab in the strip. Being part of the page, it turns with it: going forward, the new page's bookmark arrives on the turning leaf; going
  back, the old one leaves on it. It never slides along the strip. The tab lights when its
  bookmark comes into view. A bookmark lands on whichever page lies under its tab, so a tab
  over the right page drops its bookmark there. Riffled pages carry their own bookmarks past
  their tabs. While a second level is zoomed in (D8), the chapter's bookmark is on the left
  page, out of view, and its tab in the strip stays lit.
- D5. **No spine control and no flat pages** (round five, replacing round four's spine
  arrows). The spine stays in the middle. Only a second level moves the view, by the zoom and
  its scroll (D8, D9); the book itself never changes size or shape.
- D6. **The Explorer is the Even layout.** Left page: search, the book and line controls,
  and the board. Right page: the book view on top, the engine in the middle, master moves at
  the bottom, and the line in the outer margin as a scoresheet with the ply. The scoresheet is
  the page's only move list; the line under the right page goes (Q6's answer). The Treemap is
  not part of it; it is unfinished and stays out for now.
  From the user's answers of 2026-10-16, on starting the Explorer: the right page's slots are
  fixed in size, without today's resize handles, since the swap gives the bigger view. The
  scoresheet's buttons keep Play, beside first, back, forward and last. While the board is on
  a line picked from the search or "View lines", the scoresheet lists that line to its end,
  the moves ahead faint, as today's move row does.
- D7. **The book view can swap with the board.** The view moves to the left page at full
  size, and the board to the right page's top slot, small but still playable. One button does
  both ways, and it stays in one place: the right end of the right page's top slot. The point
  is a bigger view with the board still at hand.
- D8. **A second level turns, then zooms in, and scrolls** (Q10, replacing the book slide;
  the order and the scroll are the user's of 2026-10-16). Opening a Library book's page turns
  the leaf to a spread whose left page shows the book list, right-aligned toward the spine
  with the way back to all books above it, enough to switch books without going back (Q8's
  answer), and whose right page is the book's page. The view then zooms in, starting about
  45% of the way into the turn, until the right page fills the window but for about 290 px of
  the left page at the window's left edge. Going back runs it in reverse: the view zooms out
  from wherever it was scrolled to, and the leaf turns back about 45% of the way into the
  zoom. Both run at the mockup's Fast speed (a zoom of about 375 ms). Picking another book in
  the list re-inks the right page (D13) and goes back to the page's top. A second level's
  pages are laid out for the zoomed view: drawn at the window's size and set onto the page
  that much smaller, so zoomed in their type reads at the usual size. The whole page is laid
  out, and the view scrolls down it to the book's bottom. The book's shape bounds that (D5):
  about half a window more, from roughly 290 px at the narrowest spread to 690 px on a large
  desktop. The page's first screen holds what it opens on, and what it holds below the
  window's bottom is there to scroll to. While the view is scrolled down, the strip hides. It
  drops down over the book when the mouse comes to the window's top edge and goes again when
  the mouse leaves it; it also shows while the keyboard is in it, and on a touch screen when
  the view scrolls up. Scrolled to the top, it is above the book as on every other page. The
  user chose this over zooming first with only the part in view laid out (built on
  2026-10-15): a tester felt something was missing below that they couldn't scroll to, and
  found a zoom only on second levels odd; turning first shows the whole page before the view
  moves in. They had passed the scroll over before because the strip lay over the book.
  Under None or reduced motion it changes at once, as do the browser's back and forward
  buttons.
  From the user's answers of 2026-10-15, on starting the Library: the list is the mockup's
  left page, its rows contents lines (side, name, dotted leader, positions). The positions
  figure may one day give way to something more personal, such as success or how much of the
  book is explored, so it is one slot of the row. On a phone, where the halves stack, a book's
  row opens its page; where they sit side by side, it picks the book as in a spread. Notices
  (the backup notice, the copy offered at sign-in) sit under the left page's header, a restore
  or copy checklist takes the right page until it is done, and debug mode's panel is at the
  foot of the left page.
  From the user's answers of 2026-10-16: the book's page keeps its title, its buttons, the
  view and the board on its first screen; its measures and where it came from go below, with
  room for the statistics to come. The list scrolls with the page, as paper does.
- D9. **The Bookstore keeps search and filters on its left page.** A store book's page turns,
  zooms and scrolls the same way (D8), and the part of the second level's left page in view lists
  the shelf's books, as the search and filters left them, right-aligned toward the spine
  with a link back to the shelf above them, as the Library's does (the user's answer of
  2026-10-15).
  From the user's answer of 2026-10-16, on starting the Bookstore: the left page holds the
  search and filters only. The mockup's shelves (all books, for White, for Black) would only
  repeat the side filter, so real shelves, such as by opening family or publisher, wait for
  the store's back end (`bookstore.md`).
- D10. **The Overview and Settings are spreads.** The Overview's left page is the book's
  contents, a chapter per page in book order with dotted leaders, and its right page shows
  the picked chapter's demo and description. Pressing works as it does today: the first
  press shows a chapter, and a second press or its "Jump to page" tag goes there. The
  contents include a Vibes chapter marked coming soon, with no page to jump to yet. Settings
  has appearance on the left page, and your data and account on the right.
  From the user's answers of 2026-10-15, on starting Phase 3: the chapters are numbered as
  the mockup numbers them, and the folios follow. The Overview is the contents, front matter
  with no number, so the Explorer is Chapter I and Vibes VII, and every folio counts the
  Vibes chapter ("of VIII"). The Overview's left page is the mockup's: the contents, then what
  an account adds, with the sign-in offer below it. The right page changes only when a
  chapter is picked; today's cycling of the demos goes. The intro and the deployment notes
  leave the Overview. Settings takes the deployment notes, with a thank-you to Lichess and
  room for a message from the developer.
- D11. **Train and Puzzles keep placeholder spreads** until they have plans of their own.
- D12. **Vibes dress the book, not its surroundings** (`vibes.md` D14). The vibes switch
  sits in the strip, beside the account links.
- D13. **Pages move in book order, by page turn or not at all** (Q2). Settings offers Page
  turn and None; Page turn is the default, and None is forced when the system asks for
  reduced motion. Slide, a third setting that moved the spreads across the window, was built
  and dropped on 2026-10-15: the user found it odd. Other motions may come with the game-like
  pages that move away from the book (the trainer, puzzles), not for the book's chapters. A
  jump of several pages riffles up to three leaves. Changes within a spread never
  turn; picking another book, swapping the board or picking an Overview chapter re-inks the
  page. A turn takes about 450 ms.
- D14. **Turns are built with view transitions** (Q3). Next.js 16 supports React's
  `ViewTransition` (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). The
  browser takes a picture of each page, renders the new pages once, and animates the
  pictures, so a turn costs about the same whatever the page holds. A picture can't be one
  leaf with two faces, so a turn is drawn in two halves: the old page folds to the spine,
  then the new one opens from it. A page's picture includes what sticks out of it, so the
  bookmark and the page tab turn with the page for free. Browsers without support change
  pages instantly. A spike comes first (Phase 2). It found that each page needs a name of its
  own, from its route, so the leaving and arriving pages are separate groups that the turn can
  stack; under one shared name WebKit ignores which lies on top.
- D15. **Narrow windows and phones get the one-page form** (Q4; its look from rounds six and seven).
  Below the width at which the board would fall under about 440 px (around 1,100 px of
  window), the book is one page. It is the default on phones. The book is open, not closed:
  the page is its left page, with the gutter at its right and the facing page running on
  past the window's right edge, so the book has no visible end there, and leaves turn on
  that gutter. Forward, the next leaf comes over from the gutter
  and lies down; back, the page lifts away over it. The chapters stay in a column at the left,
  apart from the page, as the strip's tabs are apart from the spread. The page carries a short
  tab, a ribbon around its fore-edge that reaches just past the page edges to meet its
  chapter, so the tab turns with its page as the bookmark does in a spread. The column
  narrows to icons, and on a phone it is icons only. A spread's two halves sit side by side
  inside the page where they fit and stack on a phone; a second level shows only its own page
  with a back link. The Explorer stacks the board above the analysis, as it does today
  (`docs/design/explorer.md`).
- D16. **The Labyrinth's Explorer tab says "coming soon"** (Q5). The user will revisit it, so
  this plan doesn't build it there. What was found stays in the Notes for that work.
- D17. **With a book chosen, the Explorer's book view draws the book** (Q6), in whichever of
  the five views is picked, with the current position marked. Moves played past the end of
  the book are drawn dashed from where they left it, and the running head says "out of book".
  With no book chosen it draws today's explored tree, and a switch on the view's header goes
  back to it when a book is chosen. The user wants grouped lines seen as shapes, not listed as
  text the way other apps do.
- D18. **Visualizations is a chapter with its own tab again** (Q7), between the Explorer and
  the Library as in `NAV_ITEMS`. This rolls back the page merge of round four, as a trial.
  Its left page lists the visualizations as contents, grouped; its right page shows the picked
  one with a preview, its summary and "Jump to page". Each one opens on a page of its own,
  a second level (D8) whose left page lists the visualizations to switch between (the
  user's answer of 2026-10-15).
  From the user's answers of 2026-10-16, on starting Visualizations: the preview is a
  screenshot of each visualization for now. Only the book views' own pages are rebuilt for
  the book; the Labyrinth, the Treemap and the prototypes keep their page frames on the right
  page. The list on the left page switches between the book views and keeps the book, so
  their pages lose the rail. Later the same day the user took the 2D map off the chapter, and gave the globe a choice
  of every opening or one book (`docs/design/lab-prototypes.md`).
- D19. **The book comes now** (Q9). Everything else builds on it, so `deployment.md`'s
  Phases 6 (phones and themes) and 7 (launch, with the Overview's demos) are done on the book.

## Steps

Drafted 2026-10-14, once Q1–Q9 were answered, and approved the same day ("Lets do phase one
and get to the test of turns").

### Phase 0. Mockups

- [x] (agent) Rounds three to seven of `plans/mockups/dashboard-spread.html`.
- [x] (user) Answer Q1–Q9 (D13–D19).

### Phase 1. Tokens, fonts and book areas (D2, D3)

- [x] (agent) Literata, Atkinson Hyperlegible and IBM Plex Mono through `next/font`, as the
      `--font-*` tokens.
- [x] (agent) The paper palette in light and dark in `globals.css`: desk, page, rule, cover,
      page edge, gutter, turn shade and bookmark, beside shadcn/ui's names, which are now
      made from them. The live dashboard takes it at once; its sidebar keeps its own colors
      until the shell replaces it.
- [x] (agent) The book's vibe areas marked with `data-slot` (book, cover, page, page edge,
      gutter, running head, folio, margin) on the book's parts in `src/components/book/`.
      They replace the frame's areas when the shell does (`vibes.md` D14).
- [x] (agent) A unit test that every text and background pair passes WCAG AA in both themes
      (`src/lib/theme/contrast.test.ts`). It moved four colors a shade: the muted text in
      both themes, dark mode's destructive red and the old sidebar's muted text.

### Phase 2. The book frame (D1, D3–D5, D8, D9, D12–D15)

- [x] (agent) Spike: a two-page turn with view transitions on a scratch route
      (`/spike/book-turn`), with bookmarks, the one-page form and its page tabs. It works in
      Chromium and Firefox. Playwright's WebKit runs every animation with the right timing but
      doesn't draw the arriving page during the turn, which may be that build's fault (it is
      WebKit on Windows, not Safari).
- [x] (user) Watch the spike, in Chrome and on a real Safari (an iPhone or a Mac) if you have
      one. Chrome looked right but for a pause in the one-page turn near edge-on: a CSS easing
      applies between each pair of keyframes, so a middle keyframe stalled the swing there;
      the swing now has two keyframes and a separate fade. Safari didn't look right; the user
      put it off to Phase 4. The route goes once the shell is built.
- [x] (agent) A pure layout function for the book: given the window, the form and the slide,
      the rectangles of the pages, the cover, the page edges, each tab's bookmark and, in the
      one-page form, each page tab. Property tests: the pages never overlap, everything fits
      the desk, the board's square fits its page at every listed window size, edge thickness
      grows with book order, every bookmark lies under its tab and on the page below it,
      every page tab lines up with its slot, and identical input gives identical output.
      Done as `layoutBook` (`src/lib/book/layout.ts`), which also lists the window sizes
      (`BOOK_WINDOW_SIZES`) for Phase 4's browser tests. The spread starts at 1,100 px, where
      the left page's body is 440 px wide; it is worked out from the margins, not set. The
      stacks run from thin to thick over the whole book whatever its length, and turning
      moves no page. On phones the Explorer's board is 255–285 px, against about 325–355 px
      today, since the chapter column, the page tab and the facing page take their share.
- [x] (agent) The book shell in place of `DashboardShell`: the strip (brand, tabs from
      `NAV_ITEMS`, vibes switch, account links), the desk, the cover, the page edges, two page
      slots and the bookmarks. A page renders a spread component with its left page, its
      right page and, for a second level, how far the book slides.
      Done as `BookFrame` and `Spread` (`src/components/book/`). Each page renders its own
      book, so its slide is its own. The frame is drawn with CSS made from the layout's
      constants (`bookFrameCss`), so the server render is in place before any script; the
      server renders the form the last visit had (a cookie). It also draws the one-page form's
      chapter column (names, or icons on a phone), page and page tabs, so narrow windows work
      meanwhile; that step keeps its turns and polish. Until Phase 3, every page sits in
      `InterimSpread`, its old content laid across both pages. `DashboardShell` and the
      sidebar's colors are gone. The spike stays until the turns step moves its CSS.
- [x] (agent) Board pages fit their page instead of the viewport. `--dash-offset` gives way to
      the page's own height, and the board-page rule in `AGENTS.md` changes with it.
      Done: a board page is `h-full` in its page's body, and the Explorer's narrow board is
      capped at a share of the page's height (`cqh`), not the window's. `--dash-offset` and
      `bodyOffset` are gone.
- [x] (agent) Turns, riffles, Slide and None, and the motion setting (D13, D14).
      Done: the spike's turns, in both forms, are `src/components/book/turns.css`, and the
      spike route is gone. The frame works out the way from book order (`turnBetween`) and
      writes it on `<html>`, so every link turns, not only the tabs; the browser's back and
      forward buttons change pages at once, since Next doesn't run them as transitions. React
      gives a page its enter and exit only when none of the page's own elements lies above it,
      so the book moved into the frame and pages render their pages into it; a second level
      now says only that it slides, by `SLIDE_SHOWN` (D8, D9's 300 px or so), and the book
      takes it from its left page. Riffled leaves carry their chapters' bookmarks or page tabs.
      An interim page's content can't be cut at the spine, so it stays on the pages that lie
      still while blank leaves turn. The setting is on the Settings page until Phase 3
      rebuilds it. Slide was dropped afterwards (D13).
- [x] (agent) The zoom and turn for second levels, with the Bookstore's strip (D8, D9).
      Done: a page below a chapter's own page is its second level (`levelAt`), and the
      spread's camera (`src/lib/book/camera.ts`) zooms in on it; `SLIDE_SHOWN` is gone. The
      live book sits at the new camera from the start, and each picture of the turn is moved
      with the camera on its own, since Firefox doesn't move a picture with its live page. The
      book is a picture of its own, and the strip lies over the pages, since zoomed in a
      turning leaf rises past the desk's top. Until Phase 3 an interim second level shows its
      content on the right page and only "Back to …" on the left; the lists of D8 and D9 come
      with the Library and Bookstore pages. Playwright's WebKit on Windows draws the zoom out
      wrong (the leaf over the strip, the new pages unmoved), like its turns in the spike; the
      Safari step in Phase 4 covers it.
- [x] (agent) The one-page form: the open left page with its gutter at the right and the
      facing page running off the window, turns on the gutter, the page tabs and the phone's
      icon tabs (D15).
      Done: most of it came with the shell and turns steps. This step added round seven's
      button that narrows the chapter column to icons or widens it to names, kept in a cookie
      so the server renders the pick (a phone has icons only and no button); the way back in a
      second level's running head; and a page tab that reaches onto the page short of its
      text, which on a phone it covered. The figures beside the mockup's chapter names (book
      counts, "soon") are left to Phase 3, with the Overview's contents.

### Phase 3. The pages, each with its browser tests

- [x] (agent) Overview (D10): the contents, with the Vibes chapter, and the demo window as a
      spread. The Vibes chapter is declared beside `NAV_ITEMS`, so the Overview still reads
      one list.
      Done as `OverviewSpread`, reading `bookContents` (`VIBES_CHAPTER` before Settings). The
      contents fit the left page at every spread size by dropping the chapters' summaries,
      then the line under the title, on shorter pages; in the one-page form a pick scrolls
      to the chapter below the contents. The folios count from the Explorer. The guest and
      account table is the mockup's three rows. The deployment notes and a thank-you to
      Lichess sit on the interim Settings page until its step. The chapter column marks the
      pages coming soon; its counts (books, visualizations) come with the pages that own
      them.
- [x] (agent) Library (D8): the first level as a spread, the second by the zoom and turn.
      Done: the first level is "Your books" and the list on the left page, the picked book on
      the right with its view filling the page and no board (the board is on the book's own
      page); an empty library has the Bookstore's books on the right. The book's page lists
      the books beside it, and another book re-inks without a turn. Its position column
      scrolls on its own where the page is short. The route reads `?book=` on the server: a
      Suspense boundary around the whole spread showed nothing while the page's code loaded,
      which started the turn without the arriving pages. The chapter column gives the
      Library's book count (`ChapterFigure`). The zoomed gutter's gradient no longer repeats,
      which had drawn a faint line down the right page. `OriginPanel` is gone; its credit and
      link back to the Bookstore sit under the book's title.
- [x] (agent) Second levels turn, then zoom, and scroll (D8, 2026-10-16), with the strip that
      hides while the view is scrolled down, and the Library book page's measures and origin
      below its first screen.
      Done: the timing is swapped (`moveTiming`), and the zoomed page is laid out whole, its
      body the first screen (`.book-fold`) and `below` after it. The strip lies over the
      desk's top on every page, so a second level's desk scrolls under it, to the zoomed
      cover's bottom (`zoomReach`); a move off a scrolled page starts its camera there. The
      desk's scrollbar is hidden, since it would narrow the book, and a thumb of the frame's
      takes its place, coming in once the zoom is over. Firefox runs every animation, but
      Playwright's Firefox screenshots don't draw view transitions, so its frames weren't
      looked at.
- [x] (agent) Bookstore (D9): the first level as a spread, a book's page by the turn and zoom.
      Done: the left page is the title, search, side and Verified only; the right page is the
      shelf, a card per book in two columns where the page has room, the mockup's cards. The
      filters travel in the addresses (`?q=&side=&verified=`), so a book's page lists the shelf
      they left and "Back to the shelf" keeps them. The book's page is laid out as the Library
      book's: its name, publisher, description, Save and the book on the first screen, its
      measures and how it was made below.
- [x] (agent) Explorer (D6, D7, D16, D17): the Even layout, the scoresheet, the swap, the
      chosen book in the book view, and the Labyrinth tab marked coming soon.
      Done: the page is a spread (`OpeningExplorer` passes its one-page form to `Spread` as
      `single`, the board on top). The swap moves the live board with `react-reverse-portal`,
      so it keeps its game. D17's switch is two tabs on the view's head, Book and Explored,
      beside the Labyrinth's; `bookLineTree` adds the moves played past the book's end,
      which every view draws dashed. The screenshot baseline `explorer-start.png` is out of
      date until Phase 4's new baselines.
- [x] (agent) Visualizations (D18): the contents and the preview as a spread, and each
      visualization's own page in the book.
      Done: the contents are grouped as the mockup's (`VISUALIZATION_GROUPS`), and the
      preview is a screenshot per theme, taken by `npm run demos:shots`. Each visualization's
      page is a second level (`VisualizationLevel`); the way back picks it again
      (`?show=`). A book view's page is laid out as a Library book's, its measures and
      source below the first screen; on one page a View menu stands in for the list. The
      chapter column gives the count of visualizations. `RouteCard` and `ResizeHandle` are
      unused now, and listed as kept on purpose in `AGENTS.md`.
- [x] (agent) Settings (D10, D13): appearance, page turns and the vibes switch on the left;
      your books, the account and the bug report on the right, and the deployment notes, a
      thank-you to Lichess and a message from the developer.
      Done as `SettingsSpread`: the deployment notes, the thanks and the developer's message
      sit under Appearance on the left page, which has room for them. Back up is the Library's
      (`useBackup`); Restore is a way to the Library page, since it needs the Library's
      checklist. The bug report row shows in debug mode only, as the strip's button does. The
      message shows once `DEVELOPER_MESSAGE` is written.
- [ ] (user) Write the developer's message for Settings.
- [ ] (agent) The Train and Puzzles placeholders (D11), and the sign-in pages as one page on
      the desk.
      The placeholders are done (`PlaceholderSpread`), from the mockup's: a title page on the
      left, what the chapter will be on the right, marked coming soon. The scaffolds they
      replaced are kept on purpose (`AGENTS.md`), and a book's Train button still opens the
      trainer's scaffold. The sign-in pages are still to do.

### Phase 4. Checks and docs

- [ ] (agent) Browser tests: each page fits at the listed window sizes and the page body
      never scrolls; each bookmark and page tab meets its tab; turns go the right way; None
      and reduced motion change pages instantly. New screenshot baselines
      (this takes over `vibes.md` Phase 1's open step).
- [ ] (user, agent) Safari: the turns and the zoom on a real iPhone or Mac, from a
      production build on the local network. The spike's turns didn't look right there
      (2026-10-14); find out what Safari draws wrong and fix it, or give Safari None until
      it can. The Done-when needs Safari.
- [ ] (agent) A slow-device check: turns and the zoom with Chromium's CPU throttled four
      times. If they stutter, the user decides whether None becomes the default anywhere,
      phones first.
- [ ] (agent) Docs: `docs/design/dashboard.md` and `docs/design/explorer.md` rewritten for
      the book, the UI rules in `AGENTS.md` (`Panel`, `--dash-offset`, the vibe areas, what
      reads `NAV_ITEMS`), and the mockup moved to `docs/design/mockups/`.
- [ ] (user) Check every page in light and dark, wide and at phone width.
- [ ] (user, agent) Record the Overview's demos on the book (`deployment.md` Phase 7).

## Notes

**One mechanism.** Almost everything in the book is the leaf's turn and the zoom. A
spread is two pages at the middle spine; a second level turns and zooms in;
the one-page form is the same turn hinged on the right edge. Bookmarks and page tabs are part
of their pages, so they need no animation of their own. Pages state what each page holds and
whether a page is a second level, which keeps the narrow form from becoming a second app to
test.

**What stays.** shadcn/ui's controls (`vibes.md` D12). The board's squares and pieces, and
the book views' own colors (`vibes.md` D11). `NAV_ITEMS` as the one list of pages, which the
tabs, the Overview's contents and the proxy read. The guest and account rules in
`AGENTS.md`.

**Cost to the client.** The cover, page edges, gutter and bookmarks are CSS. A turn animates
pictures of pages, not live pages (D14). The book adds no library; view transitions are built
into React and the browser. The engine and its light and heavy settings are unchanged, so a
"light version" of the app becomes a motion setting rather than a second build.

**The Labyrinth in the Explorer, for when the user revisits it (D16).** The map
(`RegionMap`, `src/components/lab/`) is self-contained: a canvas with its own loader through
`/api/openings/explorer` and its own camera. It tells its page which position it is inside
(`onFrame`), but nothing can yet tell it to go to a position. So it fits the top slot or the
swapped left page as it is; zooming the map can move the board, but the board can't move the
map until the focus work in `region-map.md`. It needs an account until the guest snapshot
ships. Its requests would be a named exception to the Explorer's rule that the tree window
makes no API calls of its own (`docs/design/explorer.md`).

**What the mockup shows that isn't decided.** The vibe is a sample, to show the kind of
change a vibe makes (`vibes.md` D14, D15). The figures, the engine lines and the
visualization previews are sample drawings.
