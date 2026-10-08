# Public deployment

Status: active · Updated: 2026-10-07 · Depends on: —

**Goal:** put ByTheBook on Vercel so guests can use it without an
account, while up to about 100 beta testers sign in and keep their data.
**Done when:** guests and beta users can both use the live deployment reliably in current
Chrome, Safari and Firefox, and the Overview page and explorer work on a phone (D9).

## Decisions

- D1. The app stays mostly client-side, and server work stays limited to single-row reads
  and writes, so load stays predictable (see "Data and APIs" in `AGENTS.md`).
  > ME: Let me know what the hard limitations of this single row read and writes are, the does need to be usable after all.

  *Amended 2026-10-03 (`data-delivery.md` D4, from the user's approval of a batch route):*
  a request may also read a capped batch of rows by primary key. What stays ruled out is
  reading without a bound: scans, aggregates and searches across users or books.
- D2. Anyone can use the site without an account. Saving to the server needs a beta account.
- D3. Creating an account needs a beta key, and accounts are capped at about 100, so the
  user controls the load.
  > ME: I would also like to implement a user load ceiling. Users should have a certain amount of lichess api calls per certain amount of time and a certain amount of server calls per certain amount of time. If this doesnt seem to complex, lets start collecting data on amounts of calls when I test parts of the app myself.
- D4. The app must work across browsers and devices. This is a requirement, not a wishlist
  item.
- D5. A single performance setting that lowers graphics and compute load is on the wishlist.
  It stays out of this plan (D15).
- D6. Beta testers get accounts through one-time invite codes. A tester enters a code and
  picks their own email and password, and the code is used up. More codes can be generated
  whenever they're wanted. Premade accounts would mean choosing people's credentials and
  sending passwords around.
- D7. Guests never trigger Lichess calls; they read only what is already in
  `position_cache`. Beta users can also fetch live, which is the main thing an account adds.
  A one-time script, run locally, fills the cache for every catalog position, so guests
  still get master stats for every named opening.
- D8. Each user has a ceiling on Lichess calls and on server calls per period of time (from
  the note on D3). Counting isn't complex, so it lands first, and the ceilings are set from
  the numbers the user collects while testing.
- D9. The Overview page and the explorer must be functional on a phone. A collapsible
  sidebar is part of that, and desktop gets it too, since pages like the drills benefit from
  the focus. Other pages can stay desktop-first for now.
- D10. Vocabulary. A **book** is one opening tree ("Queen's Gambit", "King's Indian Defense
  with Modern", "Gambits"). A **repertoire** is a union of books that covers a goal better
  than one book can ("Draw with Black" is the Berlin Defense plus companion books for the
  refutations and sidelines), and it is drilled the same way a book is. The **Bookstore** is
  a page where users pick default books; shared book codes and publicly uploaded books may
  follow. Users also make their own books and repertoires.
- D11. Guests who want to keep their data can export and import books and repertoires as
  files. This must not add load to the back end. D13 says where it is built.
- D12. A guest's work also saves automatically in their browser, so a refresh or a return
  visit doesn't lose it, and a notice tells guests they can export and import as well.
  Guests and signed-in users go through one interface, the **library**. It uses IndexedDB,
  because localStorage stops at about 5 MB per site. At sign-up the app detects a library
  in the browser and offers to copy it into the new account, and offers to upload earlier
  books, repertoires or libraries from a file. Later the library may hold everything a user
  has (game history, books, repertoires and their drill statistics), so drills done as a
  guest can sync into an account. The interface must not rule that out.

  *Amended 2026-10-07 (D22):* the copy is offered at any sign-in, not only at sign-up.
- D13. The Bookstore, repertoires, export/import and game-history import are built in their
  own plans, `bookstore.md` and `game-history.md`. This plan ships a placeholder Bookstore
  page, and "coming soon" sections in the Library for game history and for export and
  import. Export files carry a version number.

  *Amended 2026-10-07 (D23):* Back up and Restore ship with the Library in place of the
  export and import prompts. Game history keeps its "coming soon" section.
- D14. Forgotten passwords are handled with reset codes during the beta and by email later.
  A reset code is an invite code with a different purpose: the user generates one for a
  tester's account, the tester enters it with a new password, and the server sets the
  password through Supabase's admin API. Email reset needs an email provider and an owned
  domain, so it waits until sign-up opens beyond the beta.
- D15. The performance setting is left out of this plan. It may come back to let people cut
  browser storage or visualization complexity, with the Full and Lite values worked out in
  the visualization prototypes. One piece lands now if it is easy: detect the device and
  warn phone users when they turn on the full engine.
- D16. There is no landing page. `/` redirects to `/dashboard`, so a visitor lands inside
  the app as a guest (D2) and a returning user lands signed in. The dashboard's Overview
  page does the landing page's job: it explains the app, shows what a guest and an account
  can each do, describes the deployment's limits, and holds the demo window (D19).
- D17. What a guest and a signed-in user may do. The rules live in
  `src/lib/auth/access.ts`, which the sidebar, the proxy, the Overview page and the
  Visualizations page all read.

  | | Guest | Signed in |
  |---|---|---|
  | Pages | Every page except the visualization prototypes, which are listed but not opened | Every page |
  | Master stats | Cached positions only; never causes a Lichess call (D7) | Cached, plus live Lichess, counted (D8) |
  | Engine and appearance settings | Yes, in the browser | Yes, in the browser |
  | Books | Create, edit and keep in this browser (D12, amended 2026-10-07 by Phase 5), with Back up and Restore (D23) | Create, edit and keep in the account |
  | API routes other than the explorer | 401 | Yes |

- D18. The sidebar names what each page is for. **Overview** is the info page (D16).
  **Explorer** is board analysis. **Visualizations** is the experimental visualizations
  page: it has a route button for each visualization and takes over from the Lab, which is
  gone. The Treemap (the opening tree, called the Atlas until 2026-10-02) is the live one.
  The Lab's globe and 2D map are kept
  there as possible future visualizations, for signed-in users only. **Library** is the
  user's own data: books now, then repertoires and game history import, which gets no tab
  of its own. **Bookstore** is the public store. Train, Puzzles and Settings keep their
  names.
- D19. The Overview shows its page tabs and one demo window as a single group. The window
  cycles through the pages' demos by itself. Pointing at a tab only highlights it. The
  first press on a tab shows that page's demo and a longer description, which writes itself
  out a word at a time, and stops the cycling; a second press on that tab, or a press on
  its "Jump to page" tag, opens the page (changed 2026-10-01: pointing used to show the demo
  and one click routed). A button that routes to a page says so in words ("Jump to page");
  an arrow was tried and read as pointing at the demo window. On a phone the tabs are a row
  of chips that work the same way. The demo animations themselves come in Phase 7.
- D20. Button colors come from the theme tokens (`btn-primary`, `btn-secondary` and
  `btn-ghost` in `globals.css`), so a button's text stays readable on it in every
  background mode. Fixed slate or white classes on buttons are how text went missing.

From the user's answers of 2026-10-07 to the Library questions, drawn in
`docs/design/mockups/library.html`.

- D21. **The Library has two levels, laid out as mockup A.** The first level is the book list
  and search: each row carries its book's icicle in miniature, and the selected book opens
  beside the list in a book view (the icicle by default) with a board and its measures. From
  it a book goes to its second level, the Explorer or the trainer, and later a full
  visualizer. The first level may also show general facts about the user's history. The
  second level is a book's own page: a bigger book view with its options, and the fields one
  screen can't hold (difficulty, ratings, success rates, and a leaderboard where the book has
  one). Combine is an option in a book's "⋯" menu, not a header button. New book's
  recommended start is to open the Explorer and add lines, with pasted moves or PGN second,
  since few users have PGNs. Direction for later work, from the same notes:
  - Every visualization gets zoom in and out, so its small parts can be seen.
  - A book view can show the user's success rate from their game history, from the trainer,
    or not at all. Color carries it: the edge into a position in ply columns, branch points
    and spine and ribs; a red-to-green mark on the stretch of line before a station in the
    metro map; a texture over the block in the icicle.
  - The trainer page has the same two levels: pick a book with its details beside the list,
    then a page of success statistics led by difficulty, with session options and a
    leaderboard where the book has one.
  - How a publisher is labeled is `bookstore.md` D8.

  > ME: version A looks the best in browser and mobile. I very much like the decision to use the icicle by default for this use case. The only issue is that we may want to allow the user to zoom in and out, on any visual, so that they can see the smaller parts. The combine button is a little strange in the top right, maybe make it a book option instead, like in the 3 dot settings button. It Looks like you think that difficulty rating, other users' ratings, user success rates, leaderboards, and more should come later. Because they are not on the current library you showed. Given the fact that all of this data will be hard to display on one screen, lets make the library a 2 level route. 1st level is the book library and book search: it will allow the user to go to the 2nd level or the visualizer (difficult, could come later), explorer, or trainer. The 2nd level will have a bigger map for visualization (with the options), and more fields like what i was mentioning. We are going to want to think about how the visualization is going to change with user success rate, either with user game history success rate, with user trainer success rate, or no success rate displayed (different options). This will probably best be shown with color: in the case of the graph like displays A,B,E I think the color of the edge to a node would work well for a success rate visualizer; For the C metro, its tough to think of one but I think that some part of the edge leading up to a node could have a red or green success indicator; for the icicle, some sort of area texture could work well to show success rate. I have more to verify so we may want to modufy the mockups with what I've said here.

  > ME: make the verified tag outside of the publisher name highlight to avoid spoofing. Also put unverified next to unverified publishers (try not to make the connotation too negative, but it's true that such a user would be unverified). I control verification on a user by user status for now.

  > ME: If you are wondering, I think that the training page will still be filled out well. 2 tier page again. 1st tier, Users will select a book to train, with details shown in the right. 2nd tier, users will see more detailed success statistics with an emphasis on difficulty, training session options, a leaderboard if the book supports it, and maybe more.

  > ME: when creating a new book, make the default recommended option to jump to explorer and add lines instead of it being to paste a pgn. Im not sure how many people have pgns.
- D22. **Books in the browser at sign-in.** At sign-up, and at any later sign-in while the
  browser still holds books, one checklist offers to copy them into the account. Copied books
  leave the browser, so each book lives in one place; a book that fails the limit or
  validation stays, with the reason. A name already in the account is kept as a second book
  or skipped. Otherwise a signed-in user sees only the account library, and nothing syncs in
  the background.

  > ME: I like it.
- D23. **Back up and Restore ship with the Library,** for books only, in place of the
  "coming soon" prompts (amends D13). The backup is the version 1 file format, and it is a
  guest's only protection from Safari deleting a site's data after 7 days without a visit.
  Single-book export and Combine stay in `bookstore.md` Phase 5. Testing guests and accounts
  on one machine must not mix their books up (the user's note):
  - The Library always names the store it shows ("Kept in this browser" or "Saved to your
    account"), and a signed-in page reads the browser library only to offer D22's copy.
  - The browser library belongs to one browser profile and one site address, so local
    development, each preview deployment and the live site each keep their own. A guest is
    tested in a private window or a second profile; Playwright gives every test a fresh,
    empty browser, so an agent's runs never touch the user's.
  - Debug mode (`docs/design/dashboard.md`) shows what the browser library holds, with
    buttons to back it up and to empty it, and the bug report names the store and its book
    count.

  > ME: Yes, but make sure that You and I will not suffer from this browser data misalignment (both us as individuals and us together) when we are testing unauthed and authed users. We are a special case because we are trying many combinations, it could get finnicky.
- D24. **An empty library** offers New book and the Bookstore, plus Restore for someone
  arriving from another browser. The example books stand in as the Bookstore's books, so the
  empty Library's Bookstore column lists them and there is no separate examples column. Every
  book records where it came from (made by the user, the Bookstore with its publisher, a
  combination with its sources, or an import) from format version 1, so a Wikibooks credit
  (CC BY-SA) travels with every copy. Linking a Lichess or Chess.com account may come later
  (`game-history.md`), with care.

  > ME: I like the "new book" shown in the mockup. Lets have these default books show up in the bookstore column in the library. No more "default" column. Since we plan on making the library a 2 tier route, we may want to put more general information about the users history on this page as well. Potentially in the future, we may want to allow users to link their bythebook acount with their chess.com account or their lichess account. We need to be cautious with this idea though, because the devs at chess.com worry me.
- D25. **Editing in the Library:** rename, change side, duplicate, delete (through the API),
  and remove a selected move with every position after it. Lines are added in the Explorer
  and in New book. Editing inside the book views stays planned (`docs/design/explorer.md`).
  The Explorer was designed around one line at a time, so showing a whole book there needs
  its own design later.

  > ME: Agreed, we may have to work on the explorer when viewing a book. Currently, I had designed it with single lines in mind. This will not work when attempting to view a book well. But viewing the entire book in the explorer may also have disadvantages.
- D26. **The book list reads summaries.** Each book row stores a small summary: the counts
  and flags from `src/lib/books/measures.ts` and the miniature's blocks down to a minimum
  share. The browser works it out on save, and the server recomputes it while validating the
  tree, which it already walks once to parse (bounded by `MAX_BOOK_POSITIONS`), so a client
  can't misreport it. The list reads summaries in one query, and a tree loads only when its
  book opens. The second level (D21) shows more per book, and the user's own statistics will
  join it later.

  > ME: Sounds good. if we change the library to be a two tier page, more info may be displayable per book. But we should keep in mind the other user stats we may want to display in this page as well, mentioned above.
- D27. **Back end first, then the interface.** The library's code, data, routes and the wiring
  of today's pages to it are built in one pass, with only the controls those pages need.
  The shadcn/ui pass (`vibes.md` Q1) follows and builds the Library's two levels (D21) from
  the mockups. The Bookstore goes the same way: mockups first, with the example books in it,
  then its back end, then its pages in the shadcn/ui pass. The second round of Library
  mockups and the Bookstore's are in `docs/design/mockups/`, moved there once the pages
  shipped.

  *Amended 2026-10-07 (the user's choice at the shadcn/ui pass):* the Bookstore's pages came
  before its back end, reading the example books, so the back end swaps their source later
  (Phase 5b).
- D28. **No staging project for the book migration** (Q7, answered 2026-10-07: the user went
  with the recommendation). A **staging project** is a second Supabase project with the same
  tables and no real users, where a migration or a test runs before it touches the live one.
  This migration is made reversible instead: Migration A only adds columns,
  `npm run books:migrate` backs every book row up to a local file before converting it, and
  `move_node` is dropped only after the user has checked the books in the app. The schema
  baseline comes first, because the access rules and foreign keys the migration changes
  exist only in the live database. Staging comes with the load tests (`load-testing.md` Q2),
  before the Bookstore's migration.

  > ME: im not sure what you mean by staging project. i do agree with the process of building the backend here in one swoop and coming through in another swoop for shadcn refactoring. I feel like we may want to mock up the bookstore and do a similar process. Adding the newly formatted books sample books we've made to it.

## Open questions

None open.

## Steps

Every phase ends with the typecheck, tests and lint, then a user check-in and a suggested
commit. Migrations are run by the user in the Supabase SQL editor, followed by
`npm run db:types`.

### Done: Phases 0–3

The private Vercel deployment, call counting (D8), the explorer's cache-only path for
guests with `npm run cache:prefill` (D7), and invite and reset codes (D6, D14). How they
work is in `docs/architecture.md` and `docs/processes/lichess-api-and-caching.md`. Two user
steps are still open:

- [ ] (user) Use the app for a few days, then read the counts (query in Notes).
- [x?] (user) Run `npm run cache:prefill` to the end (about two hours; it can be stopped and
      resumed).

### Phase 4. Guest access (D2, D16–D19)

- [x] (agent) Done: `access.ts` with tests, the `/` redirect and proxy rules, the D18
      sidebar and pages, the Overview's tabs and demo window, and sign-in notices in place
      of account controls. How they work: `docs/design/dashboard.md` and
      `docs/architecture.md` § "Auth and API routes".
- [ ] (user) Check in a browser: the guest pages; sign in, close the browser and return to
      `/` still signed in; Sign out; the prototypes open only when signed in; the
      Overview's demo window cycles and follows the pointer.
- [ ] (user) After browsing as a guest, confirm no guest Lichess calls (query in Notes).

### Done: Phase 5. Library's back end (D12, D13, D22–D28)

Done 2026-10-07: the schema baseline and Migrations A and B (books live in
`opening_books.trees` with their `summary` and `origin`), profiles without emails,
`src/lib/library/`, the routes under RLS, the browser library and `useLibrary()` for every
page that reads books, the copy at sign-in, Back up and Restore, `persist()` and the backup
notice, and debug mode's library section. How they work: `docs/architecture.md` § "Storage
and database" and `docs/design/dashboard.md` § "Library page". The book rows saved before
the conversion stay in the git-ignored `backups/` folder. Signed-in browser tests use the
test account on the live database until staging exists; the one that makes a book deletes it
again. The two-level Library (D21), the editing controls of D25 and the Treemap's Add line,
which the user's check found missing, came in Phase 5b.

### Phase 5b. The Library's and the Bookstore's pages: the shadcn/ui pass (D21, D24, D25, D27)

Drafted and approved 2026-10-07, with the user's choices: the Bookstore reads the example
books until its back end exists, panels without real data (success rates, weakest lines,
leaderboards, history, difficulty) are left out until it exists, zoom ships for the book
views, and shadcn/ui reaches only the Library, the Bookstore and their dialogs for now
(`vibes.md` D12).

- [x] (agent) shadcn/ui on the app's tokens, the Library's two levels, New book with pasted
      moves or PGN, the "⋯" menu and Remove move, zoom on every book view, the Explorer
      opening a book and a line, the Bookstore's two levels, and the Treemap's Add line.
      Done: `docs/design/dashboard.md` § "Library page" and § "Bookstore", and
      `docs/design/explorer.md` (zoom, `?book=` and `?line=`).
- [ ] (user) Check as a guest and signed in, in each background mode and at phone width: New
      book through the Explorer and through a pasted PGN, rename, change side, duplicate,
      Remove move, zoom, saving a store book, and the Treemap's Add line on a catalog
      position.

### Phase 6. Phones and themes (D9, D15, D20)

- [x] (agent) Done: the collapsible sidebar and phone drawer, `100dvh` and phone layouts on
      the Overview, explorer, Treemap and prototypes, and theme button colors (D20), checked
      in a headless browser in every background mode. How they work:
      `docs/design/dashboard.md`.
- [ ] (agent) The trainer and puzzle pages still use `100vh` and a desktop layout. They are
      placeholders, so this waits for the pages themselves.
- [ ] (agent) A warning when a phone user turns on the heavy engine.
- [ ] (user) Check on a real phone and in Chrome DevTools device mode, and check the
      signed-in controls (book row, Library cards) in the dark background mode.

### Phase 7. Launch

- [ ] (agent) Ceilings as named constants, set from the Phase 1 counts and the load tests
      (`load-testing.md`); over the ceiling returns 429. A ceiling needs the count before answering, which changes where the
      count is written (`data-delivery.md` D5).
- [ ] (user) An uptime ping so the free Supabase project doesn't pause.
- [ ] (user, agent) Demo animations for the Overview page, and a pass over its text.
- [ ] (agent) Delete the empty `src/app/api/auth/[...nextauth]/`.
- The baseline migration was made in Phase 5 (D28).
- [ ] (agent) Move the lasting facts into `docs/` and `AGENTS.md`.

## Notes

**Server limits (answers the note on D1)**

- Per request, a Vercel function's bodies stop at 4.5 MB. A book is one row rewritten whole
  on every save, which caps a book at roughly 15,000 positions. The catalog has 7,864.
- Per month, Vercel Hobby gives 1M function calls, 4 hours of CPU and 100 GB of transfer.
  Supabase free gives a 500 MB database and 5 GB of egress.
- What bites first: the function-call count (one explorer page load fires 10–40 requests)
  and Supabase egress (the book list returns every book's whole tree, fixed in Phase 5).
  Reading several positions in one request was raised and accepted on 2026-10-03 (D1, as
  amended); the batch route and CDN caching are in `data-delivery.md`.
- D1 rules out anything that needs many rows per request: leaderboards, statistics across
  users, server-side search across books. Nothing in this plan needs those.

**Counting and guests (D7, D8, D17)**

- To read the counts: `select day, kind, user_id, calls from usage_counters order by day desc, kind;`
  Days are in UTC, and a null `user_id` is the row all guests share.
- To confirm guests cause no Lichess calls, this returns no rows:
  `select * from usage_counters where kind = 'lichess' and user_id is null;`
- Days are the only period counted. Bursts within a day are the firewall rule's job.
- Each uncached position costs a call on the user's personal Lichess token. Heavy guest
  traffic could get that token rate-limited for everyone.
  > ME: Should I consider getting more Lichess API tokens?
- Answer: no. Lichess limits by account and by IP address, so extra tokens on one account
  add nothing, and extra accounts to get around the limit risk a ban. D7 and D8 are the fix.
  Later, beta users could connect their own Lichess accounts.

**Cross-platform (D4, D9)**

- Board pages are sized with `100vh`, which breaks on iPhone Safari. `100dvh` fixes it.
- Multi-threaded Stockfish needs the COOP/COEP headers in `next.config.ts`. Multi-threaded
  WASM can run out of memory on phones, and the same headers block images and scripts from
  other sites unless those sites opt in.
- `BoardInteractive` already supports tap-to-move.
- Testing without a Mac: Chrome DevTools device mode, a real phone pointed at a Vercel
  preview URL, and Playwright's WebKit engine.
  > ME: Is chrome devtools device mode a chrome extension? Can i also limit computation to replicate mobile device processing power? I typically use chrome so chrome devtools is a good choice. 
- Answer: it's built into Chrome (F12, then Ctrl+Shift+M). The Performance panel slows the
  CPU by 4×, 6× or 20×. It is still Chrome's engine, so Safari-only problems need a real
  iPhone or Playwright's WebKit.

**Tools**

- > ME: I was thinking about downloading the "Lavish" html editing skill for doing tasks like this, does that sound like a good idea? Also, should I download the betterAuth skill so that I can implement that in a future plan?
- Answer: Lavish is optional; it is for marking up pages an agent generates, not the running
  app. Skip Better Auth: it replaces Supabase Auth, which every table's access rules depend
  on. Vercel's free Hobby plan covers a non-commercial portfolio project.
