# Book UI

Status: active · Updated: 2026-10-15 · Depends on: —

**Goal:** rebuild the dashboard as an open book: every page a spread of two pages on a desk,
with page turns, bookmarks that turn with their pages, a one-page form for narrow windows and
phones, and vibes that dress only the book.
**Done when:** every dashboard page is a spread (or one page in the one-page form), the turns
and the book slide run in current Chrome, Safari and Firefox and change instantly under
reduced motion, a phone gets the one-page form, and the browser tests and docs cover all of
it.

## Decisions

From the user's messages of 2026-10-13 and 2026-10-14, about the mockup
`plans/mockups/dashboard-spread.html` (rounds three to seven, the "Spread Pages" artifact).
Q1–Q9 were answered on 2026-10-14; D4, D8 and D13–D19 hold the answers. D4 and D15 were
amended the same day from the user's notes on round five.

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
  their tabs. While the book is slid (D8), the bookmark stays under its tab.
- D5. **No spine control and no flat pages** (round five, replacing round four's spine
  arrows). The spine stays in the middle. Only a second level moves the book, by the slide
  (D8, D9).
- D6. **The Explorer is the Even layout.** Left page: search, the book and line controls,
  and the board. Right page: the book view on top, the engine in the middle, master moves at
  the bottom, and the line in the outer margin as a scoresheet with the ply. The scoresheet is
  the page's only move list; the line under the right page goes (Q6's answer). The Treemap is
  not part of it; it is unfinished and stays out for now.
- D7. **The book view can swap with the board.** The view moves to the left page at full
  size, and the board to the right page's top slot, small but still playable. One button does
  both ways, and it stays in one place: the right end of the right page's top slot. The point
  is a bigger view with the board still at hand.
- D8. **A second level slides the whole book.** Opening a Library book's page turns no page:
  the book slides left until only the list's last 300 px or so show at the window's edge,
  right-aligned toward the spine with "All books" above it, enough to switch books without
  sliding back (Q8's answer). The book's page takes the rest. "All books" slides it back.
- D9. **The Bookstore keeps search and filters on its left page.** A store book's page slides
  the book the same way (D8), so the shelf's page is out of sight but for a strip at the
  window's edge, and that strip goes back to the shelf. Nothing else of the left page shows.
- D10. **The Overview and Settings are spreads.** The Overview's left page is the book's
  contents, a chapter per page in book order with dotted leaders, and its right page shows
  the picked chapter's demo and description. Pressing works as it does today: the first
  press shows a chapter, and a second press or its "Jump to page" tag goes there. The
  contents include a Vibes chapter marked coming soon, with no page to jump to yet. Settings
  has appearance on the left page, and your data and account on the right.
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
  one with a preview, its summary and "Jump to page". Each one opens on a page of its own.
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
- [ ] (agent) The book slide for second levels, with the Bookstore's strip (D8, D9).
      Open (Q10, 2026-10-15): the user proposes a turn and a zoom instead of the slide. Opening
      a second level turns the leaf to a spread whose right page is the book's page, then the
      view zooms in until the right page fills the window but for the left page's last 300 px
      or so, and the book runs off the window's bottom; going back zooms out, then turns
      back. Either the view can be scrolled down to the rest of the book, or the page shows
      only what fits. D5, D8 and D9 change if it's taken.
- [ ] (agent) The one-page form: the open left page with its gutter at the right and the
      facing page running off the window, turns on the gutter, the page tabs and the phone's
      icon tabs (D15).

### Phase 3. The pages, each with its browser tests

- [ ] (agent) Overview (D10): the contents, with the Vibes chapter, and the demo window as a
      spread. The Vibes chapter is declared beside `NAV_ITEMS`, so the Overview still reads
      one list.
- [ ] (agent) Library (D8): the first level as a spread, the second by the book slide.
- [ ] (agent) Bookstore (D9): the first level as a spread, a book's page by the book slide.
- [ ] (agent) Explorer (D6, D7, D16, D17): the Even layout, the scoresheet, the swap, the
      chosen book in the book view, and the Labyrinth tab marked coming soon.
- [ ] (agent) Visualizations (D18): the contents and the preview as a spread, and each
      visualization's own page in the book.
- [ ] (agent) Settings (D10, D13): appearance, page turns and the vibes switch on the left;
      your books, the account and the bug report on the right.
- [ ] (agent) The Train and Puzzles placeholders (D11), and the sign-in pages as one page on
      the desk.

### Phase 4. Checks and docs

- [ ] (agent) Browser tests: each page fits at the listed window sizes and the page body
      never scrolls; each bookmark and page tab meets its tab; turns go the right way; None
      and reduced motion change pages instantly. New screenshot baselines
      (this takes over `vibes.md` Phase 1's open step).
- [ ] (user, agent) Safari: the turns and the slide on a real iPhone or Mac, from a
      production build on the local network. The spike's turns didn't look right there
      (2026-10-14); find out what Safari draws wrong and fix it, or give Safari None until
      it can. The Done-when needs Safari.
- [ ] (agent) A slow-device check: turns and the slide with Chromium's CPU throttled four
      times. If they stutter, the user decides whether None becomes the default anywhere,
      phones first.
- [ ] (agent) Docs: `docs/design/dashboard.md` and `docs/design/explorer.md` rewritten for
      the book, the UI rules in `AGENTS.md` (`Panel`, `--dash-offset`, the vibe areas, what
      reads `NAV_ITEMS`), and the mockup moved to `docs/design/mockups/`.
- [ ] (user) Check every page in light and dark, wide and at phone width.
- [ ] (user, agent) Record the Overview's demos on the book (`deployment.md` Phase 7).

## Notes

**One mechanism.** Almost everything in the book is the leaf's turn and the book's slide. A
spread is two pages at the middle spine; a second level slides the book rather than turning;
the one-page form is the same turn hinged on the right edge. Bookmarks and page tabs are part
of their pages, so they need no animation of their own. Pages state what each page holds and
how far a second level slides, which keeps the narrow form from becoming a second app to
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
