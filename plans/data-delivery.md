# Data delivery

Status: deciding · Updated: 2026-10-03 · Depends on: —

**Goal:** send the data every visitor shares (the opening catalog, saved master statistics,
later the guest snapshot and the atlas) as static files and CDN-cached responses, so pages
load faster and fewer requests reach a function or the database.
**Done when:** the catalog is a static file instead of part of the JavaScript, saved explorer
positions come from the CDN, the Explorer's history loads its positions in one request, and
usage counts no longer delay responses.

## Decisions

From the user's replies to the architecture review on 2026-10-03.

- D1. One Next.js and TypeScript codebase, with no server in a second language. Server work
  waits on the network, not the CPU, and the atlas needs the same layout code in Node and the
  browser to draw identical maps (Notes, "Measured").
- D2. Data every visitor shares ships as versioned static files, built by local scripts and
  served from the CDN. The catalog index goes first. The guest snapshot (`region-map.md` Q1)
  and the atlas files (`atlas.md` Q3) use the same pipeline.
- D3. Saved explorer positions are served through the CDN. A **CDN** (content delivery
  network) is the layer of Vercel servers every request already passes through. It can keep
  a copy of a response and hand it to the next visitor who asks for the same address,
  without running a function or reading the database. Caching adds no load; it removes the
  work behind the request.
- D4. A batch route answers many positions in one request. This amends `deployment.md` D1.
- D5. Usage is counted once per function call, the unit Vercel bills, so `usage_counters`
  still shows who used the function calls up. The count stops delaying the response:
  without a ceiling it is written after the response is sent (`after()` from `next/server`),
  and once ceilings land (`deployment.md` Phase 7) it runs alongside the cache read rather
  than before it, because a ceiling needs the count to answer. A CDN hit runs no function,
  so it is neither billed as one nor counted (Notes, "Counting and the CDN").
- D6. Telemetry waits until these storage decisions settle (`vision.md`).

## Open questions

### Q1. What format does the catalog file use?

Today every opening stores each move four ways (SAN, UCI, FEN and position key; see
`docs/architecture.md` § "Position formats"), its PGN twice and its final FEN twice.
Measured on 2026-10-03:

| Format | Size | Compressed | Cost to load |
|---|---|---|---|
| Today: the index, inside the JavaScript | 10.1 MB | 608 KB | Parsing 10 MB of script |
| Each position once, plus a tree of UCI moves the openings point into | 0.9 MB | 142 KB | `JSON.parse`, about 4 ms |
| Names and UCI lines only | 0.4 MB | 53 KB | Replaying 37,000 moves with chess.js, about 6 s |

**Recommendation:** the middle row, with SAN on each tree node (a few percent more). The
lookups (`byEco`, `byUciPrefix`, `byPositionKey`) are rebuilt from it in the browser, a FEN's
two clocks are worked out from the moves, and the file name carries a content hash so the
CDN can keep it forever.

> ME:

### Q2. How long may the CDN keep a saved position?

**Recommendation:** a day, then serve the old copy while fetching a new one in the
background (`s-maxage=86400, stale-while-revalidate=604800`). Only answers with data are
kept; a guest's "not saved" answer isn't, so a position saved later shows up. Requests switch
from POST to GET, with the FEN's clocks fixed, so every move order that reaches a position
asks for the same address and shares one copy.

> ME:

### Q3. How big is a batch, and what happens to positions that aren't saved?

**Recommendation:** up to 50 positions, read with one query on `position_key`. A batch never
calls Lichess: it returns the saved positions and lists the rest, and a signed-in user's
browser asks for those one at a time through the single-position route, which keeps Lichess
at one request at a time. The Explorer's history (`useOpeningExplorerMulti`) uses it first;
the Labyrinth's loader can follow.

> ME:

### Q4. Check the session without a round trip?

Every route handler asks Supabase's auth server who the user is (`getUser()`), one network
trip before any work. `getClaims()` checks the session token on the server itself when the
project signs tokens with asymmetric keys (a setting in the Supabase dashboard). The cost: a
session revoked in Supabase stays usable until its token expires (an hour by default).

**Recommendation:** check the setting; if asymmetric keys are on, or can be turned on, switch
the route handlers to `getClaims()`. The proxy keeps refreshing sessions as it does now.

> ME:

## Steps

Drafted in plan mode once Q1–Q4 are answered. D5 needs no answer and can go first.

## Notes

**Counting and the CDN (D3, D5).**

- Vercel counts every request at its edge, cached or not, and a function call only when a
  request reaches a function. `usage_counters` counts function calls per user, so it answers
  "who used the function calls up".
- A CDN hit never reaches a function, so nothing counts it in `usage_counters`. That doesn't
  matter for the quota, since it costs no function call or database read. If per-user counts
  of cached reads are wanted later, the browser keeps a tally and sends it once per visit
  with the telemetry (D6): one function call per visit, not one per position.
- Vercel's usage pages show how many requests the CDN answered against how many ran a
  function, which is where the saving shows.

**Measured (2026-10-03, desktop, Node).**

- The 2026-10-02 production build had a 10.1 MB script chunk that is the catalog index
  (608 KB gzip, 366 KB brotli), loaded by the Explorer, the Treemap and the prototypes.
- Region layout takes about 2.4 ms per blob expansion, and building a frame's scene about
  0.15 ms. A blob's data takes 100 ms or more over the network, so the network sets the
  pace. A 100,000-position atlas is about 4 minutes of layout against about 28 hours of
  Lichess requests at one a second.

**When to revisit the visual engine.** Canvas 2D and the pure `src/lib/regions` code stay.
Consider WebGL if drawing, not layout, misses the frame budget with thousands of shapes, or
for textures and shape morphs; a Web Worker for layout if a phone profile shows stutter; and
WebAssembly if a heavier layout, such as the territory map's Voronoi treemap, is too slow on
phones.

**Offline jobs.** The atlas crawler is `atlas.md` D4. Pre-filling `position_evals` (storage
gaps in `docs/architecture.md`) would drive a native Stockfish binary locally, several times
faster than the browser's WebAssembly build.
