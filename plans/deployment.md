# Public deployment

Status: deciding · Updated: 2026-10-01 · Depends on: —

**Goal:** put ByTheBook on Vercel so guests, can use it without an
account, while up to about 100 beta testers sign in and keep their data.
**Done when:** guests and beta users can both use the live deployment reliably in current
Chrome, Safari and Firefox. Q5 decides whether phones are included.

## Decisions

- D1. The app stays mostly client-side, and server work stays limited to single-row reads
  and writes, so load stays predictable (see "Data and APIs" in `AGENTS.md`).
- D2. Anyone can use the site without an account. Saving to the server needs a beta account.
- D3. Creating an account needs a beta key, and accounts are capped at about 100, so the
  user controls the load.
- D4. The app must work across browsers and devices. This is a requirement, not a wishlist
  item.
- D5. A single performance setting that lowers graphics and compute load is on the wishlist.
  Q4 decides whether any of it lands in this plan.

## Open questions

### Q1. How do beta testers get accounts?

**Recommendation:** one-time invite codes. A tester enters a code and picks their own email
and password, and the code is used up. Premade accounts mean choosing people's credentials
and sending passwords around.

> ME:

### Q2. What happens to a guest's books?

**Recommendation:** they're saved in the guest's browser (localStorage), behind the same
"book store" interface that signed-in users go through. Add export and import of a books
file, and offer to copy local books into a new account at sign-up. Guest saves make no
server requests. Mock data that disappears on refresh would look broken.

> ME:

### Q3. Can guests trigger live Lichess calls in the explorer?

**Recommendation:** no. Guests read only from `position_cache`, and beta users can also
fetch live. A one-time script, run locally, fills the cache for every catalog position, so
guests still get master stats for every named opening.

> ME:

### Q4. Does the performance setting land in this plan?

**Recommendation:** only the setting and its effect on the engine. It's a Full/Lite switch
saved per device, with an automatic default based on CPU cores and touch screens. Lite uses
`useEngine`'s `light` mode. Fewer animations and hiding the 3D lab stay on the wishlist.

> ME:

### Q5. Is a mobile layout part of "done"?

**Recommendation:** yes, for the pages guests see first (landing page and explorer): usable,
not polished. Recruiters often open links on their phones. The other pages can stay
desktop-first for now.

> ME:

## Steps

Not written yet. Once Q1–Q5 are answered, the agent drafts them in plan mode. They will
cover the user's setup tasks (Vercel project, environment variables, Supabase settings) and
the code changes, in order.

## Notes

**Accounts (Q1)**

- The Supabase anon key reaches every browser, so the code check only works if public
  sign-up is turned off in the Supabase dashboard. Registration then checks and uses up the
  code on the server and creates the user with the admin client, which still works with
  sign-up off. `src/app/auth/register/page.tsx` already runs on the server and uses the
  admin client.
- Supabase's built-in email only reaches the project team's addresses. Create beta users as
  already confirmed, and reset forgotten passwords by hand in the dashboard. Add an email
  provider (Resend has a free tier) if that gets tedious.
- "Request a beta key" can start as a mailto link on the landing page.

**Guest storage (Q2)**

- Four places call `/api/openings/books` directly today: the repertoire page,
  `OpeningExplorer`, `BookEditor` and `DashboardTree`. The book store replaces those calls.
- Safari deletes a site's saved data after 7 days without a visit, which is why export and
  import matter.

**Explorer load (Q3)**

- Today all of `/dashboard` requires login (`src/proxy.ts`), and so does the explorer API.
- Each uncached position costs a call on the user's personal Lichess token. Heavy guest
  traffic could get that token rate-limited for everyone.
- Pre-filling the cache is storage gap #1 in `.dev-notes/architecture.md`, so the script
  pays off twice.

**Cross-platform (D4, Q5)**

- Board pages are sized with `100vh` (for example `OpeningExplorer.tsx`), which breaks on
  iPhone Safari. `100dvh` fixes it.
- On small screens, the dashboard sidebar sits above the content instead of collapsing.
- Multi-threaded Stockfish needs the COOP/COEP headers in `next.config.ts`. Safari supports
  them, but multi-threaded WASM can run out of memory on phones. The same headers block
  images and scripts from other sites unless those sites opt in.
- `BoardInteractive` already supports tap-to-move.
- Testing without a Mac: Chrome DevTools device mode, a real phone pointed at a Vercel
  preview URL, and Playwright's WebKit engine.

**Before going public**

- Replace the placeholder text on the landing page.
- Hide the placeholder trainer and puzzle pages from guests, or label them "coming soon".
  Consider hiding the Lab too.
- Delete the empty local folder `src/app/api/auth/[...nextauth]/`.
- Capture the current schema as a baseline migration. The tables were created outside
  migrations.
- Set up an uptime ping so the free Supabase project doesn't pause. Vercel's free Hobby plan
  covers a non-commercial portfolio project.
