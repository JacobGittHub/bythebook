# Testing and CI

Status: deciding · Updated: 2026-10-03 · Depends on: —

**Goal:** every push is checked automatically on GitHub, with each kind of test doing one
job.
**Done when:** GitHub Actions runs the typecheck, lint, Vitest and Playwright on every push
and pull request, `main` only takes changes that pass, and the Explorer, the Overview and the
Labyrinth each have a browser test.

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

## Open questions

### Q1. Fix the lint errors before CI?

Lint has 12 errors and 1 warning today, all React hooks rules: `GlobeTest.tsx` (5),
`OpeningExplorer.tsx` (2), `useEngine.ts` (2), `BackgroundMode.tsx`, `useOpeningExplorer.ts`
and `useOpeningExplorerMulti.ts` (1 each), and a warning in `DashboardTree.tsx`. A lint step
in CI fails until they're gone.

**Recommendation:** fix them before lint blocks a merge: `OpeningExplorer`'s with D5, the
rest in one pass. Until then CI lints only the files a change touches.

> ME:

### Q2. Push to main, or merge pull requests?

**Recommendation:** work on branches and merge pull requests into `main`, with branch
protection requiring the CI checks. Vercel already builds a preview of every pushed branch,
so each pull request has a link to try. Pushing straight to `main` still works, but nothing
can stop a failing push.

> ME:

### Q3. Which views get screenshot tests?

**Recommendation:** a handful. The Labyrinth at a desktop and a phone size, with the
explorer route answered from fixture data (its seeded layout draws the same map every time);
the Overview; and the Explorer at its start position. A baseline is a PNG of tens of
kilobytes, so a handful stays under a few megabytes.

> ME:

### Q4. How can visual bugs be reported faster?

The user's note: collecting, explaining and testing small visual bugs is slow.

**Recommendation:** a "Copy bug report" button, shown only in development and to the
user's account, that copies one block of text: the page address, window size, background
mode, guest or signed in, and for the Labyrinth its camera and settings. The user pastes it
with a sentence about what's wrong. The agent opens that exact state in Playwright,
screenshots it before and after the fix, and keeps it as a screenshot test when the bug is
visual, so it can't come back.

> ME:

## Steps

Drafted in plan mode once Q1–Q4 are answered. D4 is done.

## Notes

- **Where Playwright's files go.** Reports and results go to `playwright-report/` and
  `test-results/` (gitignored). Baselines go next to their test in a `-snapshots` folder
  (committed). The planned `test:e2e:clean` script prints the size of the first two, then
  deletes them.
- **Coverage.** `vitest run --coverage` with `@vitest/coverage-v8` shows what no test
  reaches. Route handlers, `src/lib/db/` and components have no tests today.
- **Slow tests before CI.** After the `expectNoViolations` change (2026-10-03) the two
  slowest went from about 4.7 s and 4.0 s to about 0.6 s. The slowest left are in
  `bisect.test.ts` (about 2.8 s), `geometry.test.ts` and `pebble.test.ts` (about 2 s): safe
  locally, but CI machines are slower, so convert them the same way when CI is set up.
- **First test beyond pure logic:** the explorer route's guest rule (a guest's request never
  reaches Lichess), with Supabase and Lichess mocked.
- **CI needs the Supabase variables to build.** `src/lib/supabase.ts` throws on import
  without them, so `next build` in CI gets them from GitHub secrets. The tests don't touch
  the database.
- **Why the docs test exists.** Docs drifted while their "Last reviewed" dates were bumped on
  every edit, so the dates claimed reviews that never happened. The dates are gone, and the
  test checks what a date can't: that every name a doc uses still exists.
