# Atlas

Status: deciding · Updated: 2026-10-02 · Depends on: region-map.md

**Goal:** a static, pre-generated region map of master chess that every visitor sees the same
way, built piece by piece and reproducibly, so a build can stop and resume and a game's path
can be found on it.
**Done when:** a first edition, complete to a stated game threshold, opens from the
Visualizations page and draws the same map on every visit and every machine. (Draft: the
steps come once the questions below are settled.)

## Decisions

- D1. Names (`region-map.md` D7 and D9): the **Labyrinth** is the live region map, laid out
  from whatever the explorer returns. The **atlas** is the static one. Both zoom deep and
  share most of their behaviour. The opening tree that held the name is now the Treemap.
- D2. The atlas is not in development. Nothing is built until these questions are settled
  and the user starts it. Until then the Labyrinth must not rule it out: layout stays pure
  and seeded, and the model keeps a set of focuses (`region-map.md` D7).
- D3. It is built incrementally, like the cache pre-fill, and deterministically: the same
  inputs give the same map, wherever and whenever it is built (from the user's note, Notes).

## What was found (2026-10-02)

- **Lichess can cut the masters database off at a date.** The masters endpoint takes `since`
  and `until`, in whole years (Lichess API spec: "Include only games from this year or
  earlier"). This is the cutoff the note hoped for. The app doesn't send it today, so no row
  in `position_cache` is tied to a cutoff; each reflects the database on its `cached_at` day.
- **A region's shape depends on little.** A blob's children are laid out from four things:
  its own shape, its position's move counts, the settings (top p and k, layout options,
  salt), and its id, which seeds it. Its shape comes the same way from its ancestors. Freeze
  the counts on a path and the settings, and every region on it is frozen, in whatever order
  it was built (the store tests check that order doesn't matter).
- **Two things can still move a frozen map:** a change to the layout code (any constant in
  `bisect.ts`, `pebble.ts` or `layout.ts`), and floating-point differences between browsers'
  `Math.sin`, `Math.cos` and `Math.exp`, which are not required to agree to the last bit.
- **Scale.** The pre-fill pauses 1 s per Lichess call, so about 86,000 positions a day at
  best. In compact form a position's numbers take about 150 bytes (the region map plan
  estimated 1 MB for 6,700), so 100,000 positions is about 15 MB of numbers before geometry.
  How many positions each threshold reaches is unknown; at 1000 games it is at least 733
  beyond the catalog's 7,864.

## Open questions

### Q1. What fixes an edition's data?

**Recommendation:** each **edition** fetches with `until` set to the last complete year
(for example 2025) and is stamped with it. A finished year changes little, but Lichess can
still add late games, so before publishing an edition, refetch a sample and record how far
it has moved. The atlas fetches into its own store, never `position_cache`, which keeps
serving the live explorer.

> ME:

### Q2. Store geometry, or only numbers?

**Recommendation:** both. Lay out each edition once, in Node, and ship the geometry with the
numbers. Then later changes to the layout code can't move a published edition, every browser
draws the same shapes, and the client doesn't need to keep old versions of the layout
code to redraw old editions (the note's "which session algorithm to use"). Geometry roughly
doubles or triples the size; measure on the first slice.

> ME:

### Q3. Where does it live, and how does it reach the browser?

**Recommendation:** as static vector tiles, made by a local script like the pre-fill: one
file per blob every 3 plies (the display depth), holding that blob's subtree to 3 plies.
The client fetches tiles as the camera reaches them, as the Labyrinth's loader does, but from
the CDN, with no function call or database read. Not raster images: the zoom has no bottom,
so an image pyramid can't reach the depths. Where the files are hosted (the deployment's
`public/` folder, or file storage such as Supabase Storage) depends on the total size;
check each host's limits once the first slice is measured.

> ME:

### Q4. How do editions grow, and how do they age?

Your note prefers sessions that build on each other to throwing the map away.

**Recommendation:** an edition never changes once published. A later edition (a) extends
the map into regions no earlier one reached, using its own cutoff, which leaves everything
already drawn where it was, since a region's children depend only on that region; and (b)
re-lays out a subtree only when its numbers have drifted past a threshold (a share off by
some percent, or a move entering or leaving the top-p selection), with the subtree stamped
with the new edition. Every blob knows its edition, so the map can show where it is out of
date, and a refresh can be planned region by region.

> ME:

### Q5. How far does an edition reach?

**Recommendation:** "complete to N games": every move played at least N times from a
position on the map has its own region and data, which is what `--min-games N` crawls. Start
at 1000 and lower it edition by edition. Moves under N still get their region (top p and k
decide that) but no data of their own; they are drawn as the edge of the atlas.

> ME:

### Q6. What happens at the edge of the atlas?

**Recommendation:** for now, a sealed look saying the atlas ends here. Later a signed-in user
could hand off to the Labyrinth's live data inside an edge region, which fits because the
region's children depend only on it, and the engine size function (`region-map.md` Q3) could
take over past the master games.

> ME:

## Steps

Written once the questions are settled.

## Notes

**Where this came from.** The user's answer to "Regions or Labyrinth?" in `region-map.md`:

> ME: The current, dynamic regions map is the Labyrinth, The static version of the regions map will be called the atlas and it is not yet in development. The idea of the atlas is to pregenerate the static version of the dynamic masters-games-regions map so that it can represent all of chess. The idea will be like prefilling the cache, where we slowly call lichess to build up portions of the whole map. think of this process as being somewhat similar to building a massive image piece by piece. We will want to build these pieces incrementally but in a way that acknowledges the fact that we are trying to build static regions that will not change, and in a way that is reproducable (deterministic) so that we can pick up where we left off or utilize the large image with repect to a single game by taking the games predicted path based on the reproducible algorithm. yes I know lichess's masters database is always technically changing because games are always being played. This is a real challenge that may roadblock us. The only way i can think of to solve this on a server with limited storage is to pray that lichesses api allows up to make callsfor master games that prune games after a specific date. Then we can build the map for a certain amount of time with date cutoff being the first build day. After that, we decide whether to throw out the whole map and repeat the process with a new cutoff, or, and I like this next one a lot better, we pretend the first session of map building is a static estimation/foundation for what the second session can accomplish. Sessions of map building would be done with respect to a cutoff date, allowing us to do two things: one, we understand which parts of the map are outdated and decide when to throw/out reprocess parts, and two, we know which session algorithm to use and switch to when actually diving into the map. Lots of limitations and challenges with this static version so do some thinking about the challenges and come back to me. Its possible we should make this a seperate plan or doc.

**A game's path on the atlas.** A blob's id is its move path, so a game maps onto the atlas by
its moves. Where a move sits inside an "Other", the path goes through that "Other" and its
tier, which the edition's numbers fix. Live games as pins would follow the same paths.

**Transpositions.** Data is fetched and stored once per position (`toPositionKey`), but
regions are laid out per path, as the project's trees are. A transposed position has several
regions and one set of numbers.

**Another data source, not recommended for now.** Building the numbers from downloaded game
files (for example the Lichess elite database or weekly tournament archives) would give full
control of the cutoff and no API crawl, but it would be a different "masters" from the one
the explorer and the Labyrinth show.

**Being polite to Lichess.** Lichess asks API users for one request at a time and a full
minute's wait after a 429, which the pre-fill already does. A large edition takes days, so it
runs in sessions that resume, which the deterministic layout allows.
