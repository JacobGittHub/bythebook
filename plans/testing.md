# Testing and CI

Status: active · Updated: 2026-10-05 · Depends on: —

**Goal:** every push is checked automatically on GitHub, with each kind of test doing one
job.
**Done when:** GitHub Actions runs the typecheck, lint, Vitest and Playwright on every push
and pull request, lint reports no errors, and the Explorer, the Overview and the Labyrinth
each have a browser test.

## Decisions

From the user's replies to the architecture review on 2026-10-03.

- D1. Each tool has one job:
  - **TypeScript (`tsc`)** checks types. Nothing else does.
  - **ESLint** checks code patterns, such as the React hooks rules.
  - **Vitest** tests code that runs without a browser: pure functions and their
    properties, route handlers with the database mocked, and the docs
    (`docs/docs.test.ts`). It runs in Node in seconds, on every change.
  - **Playwright** tests the running app in real browsers (Chromium, Firefox, and WebKit,
    which is Safari's engine): pages, guest and account rules through the proxy, phone
    sizes, and screenshots. This is the end-to-end and system level.
  - A test that needs a browser or the running app is Playwright's; anything else is
    Vitest's. Components aren't tested in a simulated browser: their logic moves into
    functions Vitest can test, and Playwright checks what they draw.
- D2. CI runs on GitHub Actions, with its results shown as checks on GitHub.
- D3. Screenshots and videos must not pile up. Committed baseline screenshots exist only for
  a few views that draw the same way every time. Everything a run produces (reports,
  traces, videos, failure diffs) goes to gitignored folders, a script reports their size and
  deletes them, CI keeps its uploaded copies for a few days, and videos and traces are kept
  only for failing tests.
- D4. Agent test commands keep output small, and are built: `test:agent` (dot output, stops
  at the first failure, shows console output only for failures), `test:changed`,
  `test:related`, `docs:check` and `docs:sizes`. Property tests gather violations and assert
  once with `expectNoViolations`, which shows the first five and the count: an `expect` per
  check had two tests near Vitest's 5 s timeout (one timed out under load), and a full
  list of violations ran to 1 MB of output.
- D5. `OpeningExplorer.tsx` is split, with its move navigator (the highlighted line,
  `pendingForwardMoves`, autoplay) as a pure reducer with Vitest tests. That also clears its
  two lint errors.

From the user's answers to Q1–Q4 on 2026-10-05.

- D6. All lint errors are fixed before CI, so CI lints every file. `OpeningExplorer`'s two go
  with D5, and the rest go in one pass. There were 12 errors and 1 warning, all React
  hooks rules.
- D7. The user handles git and may not use branches yet. CI runs on every push to any
  branch and on every pull request. Branch protection waits until the user works through
  pull requests.
- D8. Screenshot tests start with the experimental visualizations, beginning with the
  Labyrinth. They are temporary: `npm run screens:flush` lists them and removes a view's tests
  and baselines once it's finished with. They run locally only, against Windows baselines.
  CI skips them because Linux renders fonts differently, which would make Windows baselines
  fail there.
- D9. Debug mode, which shows a "Copy bug report" button, is set by environment variables
  on the server. `DEBUG_MODE=true` turns it on. Under `next dev` the flag alone shows it to
  everyone, guests included. When the app is deployed, it shows only to signed-in accounts
  whose email is in `DEBUG_EMAILS`. The list is of emails, not usernames, because usernames
  aren't unique: a tester could register under a listed name. The button copies one block
  of text: the page address, window size, background mode, guest or signed in, and any
  state the page adds (the Labyrinth adds its line and camera). The user pastes the block
  with a sentence about what's wrong. The agent opens that state in Playwright, screenshots
  it before and after the fix, and keeps a visual bug as a screenshot test so it can't come
  back.

## Steps

- Done (2026-10-05): D4, D5 and D6 (lint reports no problems), Playwright in `e2e/` with
  explorer fixtures and a test account, the screenshot specs and `screens:flush`, the CI
  workflow, and debug mode (D9) with the Labyrinth's `?camera=`. Vitest covers the explorer
  route, the navigator, `canDebug` and the report text. Opening the Explorer at a position
  had replayed the longest named line through it and so went past it; it now stops at the
  position (`getCatalogLineToFen`). The facts are in `docs/architecture.md` (§ "Browser
  tests" and "CI"), `docs/design/dashboard.md` and `docs/design/region-map.md`.
- [ ] Repository secrets (user). Add `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` on GitHub. The first push then runs CI.
- [ ] Test account (user). Make an account with an invite code
  (`npm run invites:create`), then put its email and password in `.env.local` as
  `E2E_EMAIL` and `E2E_PASSWORD`, and in the repository secrets to run them in CI. Until
  then the Labyrinth specs, its screenshots and the Reproduce check skip.
- [ ] Labyrinth fixtures and baselines (agent, once the account exists). Record the map's
  positions with `E2E_RECORD_EXPLORER=1` and one worker, then run `npm run
  test:screens:update` and look at each new baseline.
- [ ] Debug mode on the deployed site (user). Set `DEBUG_MODE=true` and `DEBUG_EMAILS` in
  Vercel's environment variables when wanted.

## Notes

- **Why a test account.** The Labyrinth needs an account (`VISUALIZATIONS` in
  `src/lib/auth/access.ts`), so its specs sign in through the real login page. It's an
  ordinary beta account, used only for reading; the map's explorer calls are answered from
  fixtures.
- **Coverage.** `vitest run --coverage` with `@vitest/coverage-v8` shows what no test
  reaches. Route handlers, `src/lib/db/` and components have no tests today.
- **Slow tests.** The `bisect`, `insetConvex` and `shapePebble` property tests gathered
  their violations on 2026-10-05, which took each from about 1 s to under 0.5 s. The slowest
  left is `layoutChildren`'s, at about 1.7 s.
- **CI needs the Supabase variables to build.** `src/lib/supabase.ts` throws on import
  without them. Guest specs don't touch the database; the account specs sign in.
- **Hydration in browser tests.** Typing into a page before React hydrates it is lost when
  hydration resets the input. The Explorer specs wait for the statistics, which only the
  browser fetches, before they type.
- **Why the docs test exists.** Docs drifted while their "Last reviewed" dates were bumped on
  every edit, so the dates claimed reviews that never happened. The dates are gone, and the
  test checks what a date can't: that every name a doc uses still exists.
