# Load testing and telemetry

Status: deciding · Updated: 2026-10-07 · Depends on: deployment.md

**Goal:** measure how many visitors and members the app serves at once before responses slow
or fail, and use that, with the data each user stores, to decide on a limit or a queue for
entering the site and on what to change first.
**Done when:** a results table gives, for visitors alone, members alone and a mix, the most
simultaneous users served within the targets (Q4), what gave way first, and the storage per
member, and Q6 (queue, limits or neither) is answered from it.

## Decisions

From the user's message of 2026-10-07.

- D1. Load tests simulate randomly generated users with k6, the user's suggestion (why it fits
  is in Notes). Every run can be repeated exactly from its random seed.
- D2. Visitors and members are measured separately and then together, since they run
  different code: visitors only read the cache, while members also save books and fetch
  live.
- D3. The results decide whether the site limits how many people can use it at once, with a
  queue to enter, and how big that limit is.
- D4. The data each user stores is measured too, so we know how many members the database
  can hold.
- D5. Telemetry starts now: how many requests fail, and how long they take, at each load
  level. The same numbers inform later choices between scaling out and changing how parts
  of the app work, such as caching. This amends `data-delivery.md` D6, which held telemetry
  back until its storage decisions settled.
- D6. A load test never causes a Lichess call. This follows from `AGENTS.md` and the Notes on
  the Lichess token in `deployment.md`: heavy traffic on the user's token could get it
  rate-limited for everyone. How runs make sure of it is in Notes.

## Open questions

### Q1. Against Vercel or locally?

What was found on 2026-10-07:

- Vercel's policy permits load tests only on Enterprise plans, arranged in advance. An
  unannounced test is "likely to be in breach of the fair usage policy", and the traffic
  tends to get its source address blocked. Vercel's own guide adds that the bottleneck is
  usually a database or an outside API, not Vercel.
- Vercel publishes its limits. On Hobby, functions scale to 30,000 running at once, adding up
  to 1,000 every 10 seconds, and answer `503 FUNCTION_THROTTLED` beyond that. Hobby includes
  1M function calls, 4 hours of active CPU and 100 GB of transfer a month, and an allowance
  that runs out stays out until 30 days have passed. A 10-minute test at 500 requests a
  second would spend 300,000 calls, almost a third of the month.
- Supabase allows customers to test the services in their own project.

**Recommendation:** locally. Run the production build (`npm run build`, then `next start`) on
this machine, with k6 beside it, against a separate Supabase project (Q2). That tests what
is likely to give way first (the route handlers' own code and Supabase's API, database and
auth server) and leaves Vercel's part to its published numbers. On Vercel, run only a short
check at ordinary traffic (a few simulated users for a few minutes) to compare response
times with the local runs, and nothing heavier unless Vercel agrees to it first.

> ME:

### Q2. Which database do the tests use?

**Recommendation:** a second Supabase project for staging (the free plan allows two). It is
built from the baseline migration, which moves forward from `deployment.md` Phase 7, then
seeded with a copy of `position_cache` and load-test accounts. That way beta testers never
feel a test, the live usage counts stay true, and no test accounts are left in the live
project. The staging project runs on the same smallest compute size as the live one, so its
limits are the real ones: 60 direct database connections, 200 through the pooler, 500 MB of
storage and 5 GB of egress a month. The local server points at it through a separate env
file that is never committed.

Supabase limits sign-ins and token refreshes to 150 per 5 minutes per address. The test
signs every member in once, at a steady pace before the run, and reuses the sessions. Staging
can also raise that limit.

> ME:

### Q3. What do the simulated users do?

**Recommendation:** each simulated user plays one session drawn at random:

- **Visitor, Explorer:** opens the Explorer and walks a catalog line picked by how often it is
  played, one move every 2 to 8 seconds, for 5 to 25 moves, sometimes stepping back.
- **Visitor, visualizations:** opens a small visualization with an example book, or the
  Treemap, and clicks through positions.
- **Member, builder:** signs in, lists their books, opens one, adds moves and saves it (the
  whole tree, as saves work now), and explores cached positions.
- **Member, explorer:** the visitor's Explorer walk, signed in.

Each persona's requests copy the real page's: a browser recording of each persona (a HAR
file) shows which requests the page makes and in what order, so the script follows the app
rather than a guess. The pages' HTML is included, since rendering it runs functions too.
Static files (scripts, styles, images) are left out, because on Vercel the CDN serves them
and Vercel's guidance says not to test the CDN; their bytes are added up for the transfer
budget instead. Start with visitors 70% Explorer and 30% visualizations, and members half
builders and half explorers.

> ME:

### Q4. What counts as "served"?

**Recommendation:** run each load level for 3 to 5 minutes. A level counts as served if:

- fewer than 1% of requests fail (a server error or a timeout);
- 95% of cached explorer answers arrive within 500 ms, and 99% within 1.5 s;
- 95% of book saves finish within 1 s;
- 95% of pages arrive within 1.5 s.

Capacity is the highest level that meets every target. Levels: 10, 25, 50, 100, 200, 400 and
800 simultaneous users, stopping two levels after the first miss. k6 thresholds encode the
targets, so each run reports pass or fail per level. Judge times against the 10-user level as
well as the fixed targets, since a home connection adds its own delay to every database call
that Vercel, close to Supabase, wouldn't.

> ME:

### Q5. What telemetry, and where?

**Recommendation:** start with what costs nothing to store.

1. **k6's own numbers:** response times (median, 95th and 99th percentile), failures and
   throughput per request type at each level, saved as JSON summaries and k6's HTML report
   in a gitignored folder. One summary row per run goes into the results table.
2. **`Server-Timing` headers** on the route handlers, saying how long each step took (auth,
   cache read, Lichess, usage count, save). k6 turns them into per-step timings, so a slow
   response says which step was slow, and a browser's DevTools shows the same header for
   real users. It needs no storage and no outside service.
3. **During runs:** Supabase's dashboard (database CPU, memory, connections and API
   requests), and this machine's CPU, so a run in which the test machine was the bottleneck
   is thrown out.
4. **On the live site, later:** Vercel's built-in function metrics; Speed Insights for real
   users' page speed (Hobby: 10,000 data points a month, one project); and Web Analytics if
   wanted (Hobby: 50,000 events a month). Hobby keeps runtime logs for one hour. If those
   can't answer a question, the next step is OpenTelemetry through `@vercel/otel` to a free
   service.

No telemetry goes into Supabase: a row per request would double the database's writes and
spend the free plan's storage.

> ME:

### Q6. A queue, limits, or neither?

The measurements decide. The options:

1. **Neither.** If capacity is far above expected traffic (about 100 members plus visitors),
   rely on the per-user ceilings (`deployment.md` D8) and the CDN (`data-delivery.md` D3).
2. **Back off in the browser.** When the server answers 429 or 503, the app waits a growing,
   random time before retrying and shows that it's busy instead of failing. Cheap, and worth
   having whatever else is chosen.
3. **A waiting room.** Count active sessions, and make new visitors wait on a page while the
   site is full. It needs a fast shared counter that every session start touches. Postgres
   handles a single hot counter poorly, so it means a Redis service (Upstash, free through
   the Vercel Marketplace) checked in `src/proxy.ts`. An admitted visitor carries a signed
   cookie for some minutes, so the counter isn't touched on every request.
4. **Members first.** Under load, visitors are turned away or given a static fallback first,
   while members always get in.

**Recommendation:** decide after the first results. Expect 1 plus 2, with 3 held in reserve
for a sudden spike of visitors.

> ME:

### Q7. How much data does a member cost?

**Recommendation:** measure it.

- A seeding script gives the staging members books like real ones, with sizes drawn from the
  example books (75 to 1,000 positions). The sizes are then read with `pg_column_size` and
  the table sizes, in the SQL editor rather than in a function.
- Per member: books times their size, plus a `usage_counters` row per kind per day used, plus
  drill statistics once the trainer exists.
- That gives three ceilings: members that fit in 500 MB; sessions a month within Supabase's
  5 GB of egress and Vercel's 1M function calls (calls per session come from the runs); and
  simultaneous users from the load levels. The lowest is the real limit.

Already known: every save rewrites the whole book, and the 4.5 MB request limit caps a book
at about 15,000 positions (`deployment.md` Notes, "Server limits").

> ME:

## Steps

Drafted in plan mode once Q1–Q7 are answered. The likely order is in Notes.

## Notes

**Why k6 (D1).** It is free and runs locally, as one program installed with
`winget install k6`. Scripts are JavaScript or TypeScript; scenarios add users in steps;
thresholds turn targets into pass or fail; `randomSeed` makes random users repeatable; and
it writes an HTML report. It is not an npm package, so its scripts can't import from `src/`
or `node_modules`. A Node script prepares their data (catalog lines weighted by play,
restricted to positions in the staging cache), which k6 loads once and shares between users.
Alternatives: Artillery is the close second (Node, scenarios in YAML). Locust uses Python.
Grafana Cloud k6 runs the same scripts from many addresses, with 500 virtual-user hours free
a month, and is the step up if one machine can't produce enough load.

**Rules for every run.**

- No Lichess (D6). The load data lists only positions already in the cache, and the staging
  server runs with live lookups switched off by an environment variable. That is a small
  change to the explorer service, and also an emergency switch for production.
- Not the live database during the beta (Q2), and not Vercel beyond ordinary traffic without
  Vercel's agreement (Q1).
- Add users in steps, never in a sudden burst.
- Raw results go to a gitignored folder with a clean-up script like `test:e2e:clean`; the
  results table lives in this plan until its facts move to `docs/`.

**This machine as the server.** One `next start` process runs its JavaScript on one CPU core.
If it saturates before Supabase does, run several on different ports and give each simulated
user one of them; k6 needs no load balancer for that. Keep the machine under about 70% CPU,
or the result measures the computer instead of the app.

**Likely order.**

1. The staging project, the baseline migration and seeded data (user).
2. `Server-Timing` headers and the live-lookup switch (agent).
3. The load data script, the k6 scenarios, and a smoke run with 5 users (agent).
4. Load levels for visitors, then members, then the mix (the user runs them; an agent reads
   the results).
5. Storage per member (Q7), the results table, and the answer to Q6.
6. Telemetry on the live site (Q5, item 4).
