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
- D13. The Bookstore, repertoires, export/import and game-history import are built in their
  own plans, `bookstore.md` and `game-history.md`. This plan ships a placeholder Bookstore
  page, and "coming soon" sections in the Library for game history and for export and
  import. Export files carry a version number.
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
  | Books | None for now; pages that save say an account is needed. Browser storage comes with Phase 5 (D12) | Create, edit and keep |
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

### Phase 5. Library (D12, D13)

- [ ] (agent) `src/lib/library/`: the interface, a server adapter over the books API, and a
      browser adapter on IndexedDB, with tests for the logic they share.
- [ ] (agent) The four `/api/openings/books` call sites go through the library. The book
      list returns names only, and a tree loads when its book is opened.
- [ ] (agent) Sign-up detects a browser library and offers to copy it into the account.
- [ ] (agent) "Coming soon" export and import prompts in the Library, and the notice to
      guests that their work is kept in the browser.

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
- [ ] (user, agent) Capture the current schema as a baseline migration.
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
