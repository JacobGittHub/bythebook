# Public deployment

Status: deciding · Updated: 2026-10-01 · Depends on: —

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
  Q4 decides whether any of it lands in this plan.
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
  follow. "Book store" is therefore not the name of the storage interface (see Q2).
- D11. Guests who want to keep their data can export and import books and repertoires as
  files. This must not add load to the back end.

## Open questions

### Q2. How is a guest's work saved between export and import?

**Recommendation:** it also saves automatically in the guest's browser, so a refresh or a
return visit doesn't lose it. Guests and signed-in users go through one interface, called the
**library** (books come from the Bookstore and live in your library). It uses IndexedDB,
because localStorage stops at about 5 MB per site. At sign-up, offer to copy the local
library into the new account.

> ME:

### Q4. Does the performance setting land in this plan?

**Recommendation:** only the setting and its effect on the engine. It's a Full/Lite switch
saved per device, with an automatic default based on CPU cores and touch screens. Lite uses
`useEngine`'s `light` mode. Fewer animations and hiding the 3D lab stay on the wishlist.

> ME: I may want to revist this later to allow clients to reduce space usage in their browser or reduce visualization complexity to ease the load on their systems. The lab is supposed to provide me with reasonable variable amounts for the full and lite.

**Follow-up:** this can be read two ways. (a) Build the switch and its engine effect now,
choose the Full and Lite values in the lab, and extend it to storage and visualization
complexity later. (b) Leave the whole setting out of this plan until the lab has produced
those values. I'd pick (a), since the engine is where a phone struggles most. Which is it?

> ME:

### Q6. Which of the new features belong in this plan?

**Recommendation:** only the library and book export/import. The Bookstore, repertoires and
game-history import can each be finished on their own and none is needed to launch, so they
go in two new plans: `bookstore.md` (default books, then repertoires) and `game-history.md`.
The export file gets a version number and a slot for repertoires now, so those plans don't
have to change it. Agents create plans only when asked, so say so if you want them.

> ME:

### Q7. How are forgotten passwords handled during the beta?

**Recommendation:** reset codes now, email later. A reset code is an invite code with a
different purpose: you generate one for a tester's account, they enter it with a new
password, and the server sets the password through Supabase's admin API. It reuses the
invite table and form. Email reset is the long-term answer and Supabase has it built in, but
it needs an email provider and a domain you own. Add it when sign-up opens beyond the beta.

> ME:

## Steps

Not written yet. Once Q2, Q4, Q6 and Q7 are answered, the agent drafts them in plan mode.
Proposed order: (1) a private deployment of today's login-only app, with public sign-up
turned off; (2) call counting and the baseline migration; (3) the explorer's guest path,
cache key and pre-fill; (4) invite codes; (5) the library with export and import;
(6) mobile and the sidebar; (7) the pre-launch checklist, then opening the site to guests.

## Notes

**Server limits (answers the note on D1)**

- Per request, a Vercel function's request and response bodies stop at 4.5 MB. A book is one
  row rewritten whole on every save, which caps a book at roughly 15,000 positions. The
  whole catalog is 7,864.
- Per month, Vercel Hobby gives 1M function calls, 4 hours of CPU and 100 GB of transfer.
  Supabase free gives a 500 MB database and 5 GB of egress.
- What bites first: the function-call count (one explorer page load fires 10–40 requests)
  and Supabase egress (the book list returns every book's whole tree). D8's counts will
  show the real numbers. Listing names only and loading a tree when it's opened fits D1.
  Reading several positions in one request would change D1, so it gets raised with the user
  if the counts call for it.
- D1 rules out anything that needs many rows per request: leaderboards, statistics across
  users, server-side search across books. Nothing in this plan needs those.

**Accounts (D6, Q7)**

- The Supabase anon key reaches every browser, so the code check only works if public
  sign-up is turned off in the Supabase dashboard. Registration then creates the user with
  the admin client, already confirmed, because Supabase's built-in email only reaches the
  project team's addresses. `src/app/auth/register/page.tsx` already runs on the server.
- Codes come from a local script that uses the service role key in `.env.local`. It prints
  each code once and stores only its hash, in a table that only the server can read. Run it
  again for more codes. Claiming a code is one conditional update, so it can't be used twice.
- Supabase Auth owns the password hashes. The app never reads or writes them; it asks
  Supabase to set a password.
- "Request a beta key" can start as a mailto link on the landing page.

**Guest storage (D11, Q2, Q6)**

- Four places call `/api/openings/books` directly today: the repertoire page,
  `OpeningExplorer`, `BookEditor` and `DashboardTree`. The library replaces those calls.
- Safari deletes a site's saved data after 7 days without a visit, which is why export and
  import matter.
- Export and import are safe and run entirely in the browser. Import validates the file and
  replays every move with chess.js instead of trusting the file's positions, with a cap on
  file size and positions. A bad file can only affect the person importing it, and the
  server validates again when local books are copied into an account.
- Game history: the format is PGN, which Lichess and Chess.com both export. A starting
  limit is 10,000 games or 25 MB per import, parsed in a Web Worker, keeping the opening
  moves of each game as per-position counts, not the raw file. Check these in the lab.

**Explorer load (D7, D8)**

- Today all of `/dashboard` requires login (`src/proxy.ts`), and so does the explorer API.
- `position_cache` is one table shared by everyone, with no user column. A position a beta
  user fetches is stored once, and every later reader gets it, guests included. Guests read
  the same table and can't add to it.
- The cache key is the full FEN, move counters included, so a position reached by another
  move order misses. A guest can't recover from a miss, so the key changes to
  `toPositionKey()` before the pre-fill.
- The pre-fill is 7,864 positions: about two hours at one call a second, and about 40 MB.
  It is also storage gap #1 in `docs/architecture.md`, so the script pays off twice.
- Vercel isn't where this data lives; Hobby's 1 GB of Blob storage holds files, not
  lookups. More opening data means more rows in `position_cache` with the same lookup, and
  the free 500 MB holds about 100,000 positions. Supabase Pro ($25 a month) raises that to
  8 GB and ends auto-pausing; nothing here needs it. The script takes a minimum game count,
  so a deeper fill can run later.
- Each uncached position costs a call on the user's personal Lichess token. Heavy guest
  traffic could get that token rate-limited for everyone.
  > ME: Should I consider getting more Lichess API tokens?
- Answer: no. Lichess limits by account and by IP address, so extra tokens on one account
  add nothing, and extra accounts to get around the limit risk a ban. D7 and D8 are the fix.
  Later, beta users could connect their own Lichess accounts.
- Counting (D8) is one small table of per-user, per-day counts by kind of call, and one
  extra write per counted request. Guests have no user id, so they are limited by IP with
  Vercel's firewall, which allows one rate-limit rule on Hobby.

**Cross-platform (D4, D9)**

- Board pages are sized with `100vh` (for example `OpeningExplorer.tsx`), which breaks on
  iPhone Safari. `100dvh` fixes it.
- On small screens, the dashboard sidebar sits above the content instead of collapsing.
- Multi-threaded Stockfish needs the COOP/COEP headers in `next.config.ts`. Safari supports
  them, but multi-threaded WASM can run out of memory on phones. The same headers block
  images and scripts from other sites unless those sites opt in.
- `BoardInteractive` already supports tap-to-move.
- Testing without a Mac: Chrome DevTools device mode, a real phone pointed at a Vercel
  preview URL, and Playwright's WebKit engine.
  > ME: Is chrome devtools device mode a chrome extension? Can i also limit computation to replicate mobile device processing power? I typically use chrome so chrome devtools is a good choice.
- Answer: it's built into Chrome (F12, then Ctrl+Shift+M). The Performance panel slows the
  CPU by 4×, 6× or 20×. It is still Chrome's engine, so Safari-only problems need a real
  iPhone or Playwright's WebKit.

**Before going public**

- Replace the placeholder text on the landing page.
  > ME: I was thinking about downloading the "Lavish" html editing skill for doing tasks like this, does that sound like a good idea? Also, should I download the betterAuth skill so that I can implement that in a future plan?
- Answer: Lavish is optional. It is for marking up pages an agent generates, not for editing
  the site, and the landing page is an ordinary Next.js component. Skip Better Auth: it
  replaces Supabase Auth, which every table's access rules depend on.
- Hide the placeholder trainer and puzzle pages from guests, or label them "coming soon".
  Consider hiding the Lab too.
- Delete the empty local folder `src/app/api/auth/[...nextauth]/`.
- Capture the current schema as a baseline migration. The tables were created outside
  migrations.
- Set up an uptime ping so the free Supabase project doesn't pause. Vercel's free Hobby plan
  covers a non-commercial portfolio project.
