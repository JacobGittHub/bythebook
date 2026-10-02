# Public deployment

Status: active · Updated: 2026-10-01 · Depends on: —

**Goal:** put ByTheBook on Vercel so guests can use it without an
account, while up to about 100 beta testers sign in and keep their data.
**Done when:** guests and beta users can both use the live deployment reliably in current
Chrome, Safari and Firefox, and the landing page and explorer work on a phone (D9).

## Decisions

- D1. The app stays mostly client-side, and server work stays limited to single-row reads
  and writes, so load stays predictable (see "Data and APIs" in `AGENTS.md`).
  > ME: Let me know what the hard limitations of this single row read and writes are, the does need to be usable after all.
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
- D9. The landing page and the explorer must be functional on a phone. A collapsible sidebar
  is part of that, and desktop gets it too, since pages like the drills benefit from the
  focus. Other pages can stay desktop-first for now.
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
  own plans, `bookstore.md` and `game-history.md`. This plan ships placeholder routes for
  them and file-upload prompts that say export and import are coming soon. Export files
  carry a version number.
- D14. Forgotten passwords are handled with reset codes during the beta and by email later.
  A reset code is an invite code with a different purpose: the user generates one for a
  tester's account, the tester enters it with a new password, and the server sets the
  password through Supabase's admin API. Email reset needs an email provider and an owned
  domain, so it waits until sign-up opens beyond the beta.
- D15. The performance setting is left out of this plan. It may come back to let people cut
  browser storage or visualization complexity, with the Full and Lite values worked out in
  the lab. One piece lands now if it is easy: detect the device and warn phone users when
  they turn on the full engine.

## Steps

Every phase ends with the typecheck, tests and lint, then a user check-in and a suggested
commit. Migrations are run by the user in the Supabase SQL editor, followed by
`npm run db:types`.

### Phase 0. Private deployment

- [x] (user) Turn off "Allow new users to sign up" in Supabase (Authentication → Sign In /
      Providers). Existing accounts keep working.
- [x] (user) Create the Vercel project from the repo, copy in the four variables from
      `.env.local`, deploy, and check that login and the explorer work.
- [x] (user) Add one Vercel firewall rate-limit rule by IP on `/api/`. Hobby allows one, and
      after Phase 2 the explorer route answers without a login.

### Phase 1. Call counting (D8)

- [x] (agent) Migration `20261001120000_usage_counters.sql`, `src/lib/db/usage.ts`, and a
      count in every route handler and before every live Lichess call.
- [x] (user) Run the migration and regenerate the types.
- [ ] (user) Use the app for a few days, then read the counts (query in Notes).

### Phase 2. Explorer for guests (D7)

- [x] (agent) Migration `20261001120100_position_cache_position_key.sql`: the cache is keyed
      by `toPositionKey()`, and existing rows are collapsed onto the new key.
- [x] (agent) The explorer route serves cached positions to anyone. Only a signed-in user's
      request can reach Lichess.
- [x] (agent) `npm run cache:prefill`, which also takes a minimum game count for a deeper
      fill later.
- [x?] (user) Run the migration with Phase 1's, regenerate the types, push, then run
      `npm run cache:prefill` (about two hours; it can be stopped and resumed).

### Phase 3. Invite and reset codes (D6, D14)

- [x] (agent) Migration `20261001130000_access_codes.sql`, and `npm run invites:create`
      (`-- --count 5` for several, `-- --reset <email>` for a reset code).
- [x] (agent) Registration needs a code and creates an already-confirmed user with the
      admin client. `/auth/reset` takes a reset code and a new password.
- [x] (agent) A "Request a beta key" mailto link on the landing page. It shows only when
      `NEXT_PUBLIC_BETA_CONTACT_EMAIL` is set.
- [x] (user) Run the migration and regenerate the types (the typecheck fails until then).
- [ ] (user) Set `NEXT_PUBLIC_BETA_CONTACT_EMAIL` in `.env.local` and in Vercel.
- [ ] (user) Push, make a code, and register with it on the deployment. Then make a reset
      code for that account and use it at `/auth/reset`.

### Phase 4. Library (D12, D13)

- [ ] (agent) `src/lib/library/`: the interface, a server adapter over the books API, and a
      browser adapter on IndexedDB, with tests for the logic they share.
- [ ] (agent) The four `/api/openings/books` call sites go through the library. The book
      list returns names only, and a tree loads when its book is opened.
- [ ] (agent) Sign-up detects a browser library and offers to copy it into the account.
- [ ] (agent) Placeholder Bookstore and Game history pages, "coming soon" export and import
      prompts, and the notice to guests.

### Phase 5. Guests and phones (D2, D9, D15)

- [ ] (agent) `src/proxy.ts` lets guests into the dashboard. Trainer and Puzzles say "coming
      soon", and the Lab is hidden from guests.
- [ ] (agent) The explorer tells a guest when a position's stats need a beta account.
- [ ] (agent) `100dvh` on board pages, the collapsible sidebar, and an explorer that works
      at phone width.
- [ ] (agent) A warning when a phone user turns on the heavy engine.
- [ ] (user) Check on a real phone and in Chrome DevTools device mode.

### Phase 6. Launch

- [ ] (agent) Ceilings as named constants, set from the Phase 1 counts; over the ceiling
      returns 429.
- [ ] (user) An uptime ping so the free Supabase project doesn't pause.
- [ ] (agent) Landing page text; delete the empty `src/app/api/auth/[...nextauth]/`.
- [ ] (user, agent) Capture the current schema as a baseline migration.
- [ ] (agent) Move the lasting facts into `docs/` and `AGENTS.md`.

## Notes

**Server limits (answers the note on D1)**

- Per request, a Vercel function's bodies stop at 4.5 MB. A book is one row rewritten whole
  on every save, which caps a book at roughly 15,000 positions. The catalog has 7,864.
- Per month, Vercel Hobby gives 1M function calls, 4 hours of CPU and 100 GB of transfer.
  Supabase free gives a 500 MB database and 5 GB of egress.
- What bites first: the function-call count (one explorer page load fires 10–40 requests)
  and Supabase egress (the book list returns every book's whole tree, fixed in Phase 4).
  Reading several positions in one request would change D1, so it gets raised with the user
  if the counts call for it.
- D1 rules out anything that needs many rows per request: leaderboards, statistics across
  users, server-side search across books. Nothing in this plan needs those.

**Counting (D8)**

- To read the counts: `select day, kind, user_id, calls from usage_counters order by day desc, kind;`
  Days are in UTC, and a null `user_id` is the row all guests share.
- Days are the only period counted. Bursts within a day are the firewall rule's job.

**Accounts (D6, D14)**

- The Supabase anon key reaches every browser, so the code check only works with public
  sign-up turned off. Supabase's built-in email only reaches the project team's addresses,
  which is why users are created already confirmed.
- Codes come from a local script that uses the service role key in `.env.local`. It prints
  each code once and stores only its hash, in a table that only the server can read.
  Claiming a code is one conditional update, so it can't be used twice.
- Supabase Auth owns the password hashes. The app only asks Supabase to set a password.
- A code is claimed before the account is made, and released if that fails, so a tester
  whose email is already registered doesn't lose their code.
- The contact address is an environment variable so that it stays out of the public repo.

**Explorer (D7)**

- How the route, the cache and the pre-fill work is in
  `docs/processes/lichess-api-and-caching.md`.
- The free 500 MB holds about 100,000 positions; the catalog fill is about 40 MB. Supabase
  Pro ($25 a month) gives 8 GB and ends auto-pausing; nothing here needs it. Vercel isn't
  where this data lives.
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
