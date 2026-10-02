# Region map

Status: active · Updated: 2026-10-02 · Depends on: —

**Goal:** finish the Regions prototype on the Visualizations page, a zoomable 2D map in which
every move is a pebble-shaped region inside its parent move's region.
**Done when:** phases 3–7 below are checked off and the manual checks pass in `npm run dev`.

## Decisions

- D1. The design in `docs/design/region-map.md` was settled on 2026-09-29 and is
  binding. This plan tracks only the remaining build. Before starting a phase, read that
  doc's sections on the pieces the phase builds.
- D2. Phases 0–2 are done: the design record, Vitest with the pure geometry and its property
> ME: worth noting that the png that we produced looks like it contains 4 layers in many points. sticking to 3 layers from frame blob will hopefully preserve readability. The test pmg is quite the beauty though.
  tests, and the data layer (explorer route and cache changes, `fenAfterUci`, `selection`,
  `loader`).
- D3. Every phase ends with the typecheck, lint and tests. The user checks in after phases 4
  and 6, and the agent suggests a commit at each check-in.
- D4. Docs that describe code are updated in the same phase as the code.
- D5. The Lab page is gone (`deployment.md` D18). Its harness is now
  `src/components/lab/LabHarness.tsx`, which shows one prototype per page under
  `/dashboard/visualizations/`. The region map is built as a third view of that harness, with
  its own page and an entry in `VISUALIZATIONS` (`src/lib/auth/access.ts`). Where the steps
  below say "tab", read "view".
- D6. The display depth stays at 3 layers below the frame blob (from the note on D2: the
  test image showed 4 layers in many places, and 3 should keep it readable). The layer past
  it only fades in inside a blob being zoomed into (Notes, "Changes to the design").
- D7. Vocabulary, from the note under "Open questions". This build is the **labyrinth**: the
  dynamic region map, laid out live from whatever the explorer returns. The **atlas** is a
  later, static version that zooms as deep but behaves like a detailed street map, and may
  be pre-rendered. Nothing here may rule the atlas out: layout stays pure and seeded, and
  the model keeps a set of focuses.
- D8. Guests get a working region map (from the answer to Q1: it is the poster child). How
  their positions reach them is Q1. Until that is settled the page stays account-only like
  the other prototypes.

## Open questions
> ME: keep in mind the fact that we are creating something of a dynamic version of the region map, call it the labyrinth; as opposed to the static version, the atlas, that will be more similar to google-maps detail oriented static map behavior. Both zoom deep, both have many similar functionalities, but the atlas will be slightly further in the future and may be subject to computation shortcuts because we may be able to prerender it like it's predetermined. And way way down the line, maybe we could even add current games that are happening as pins on the atlas map.
### Q1. Where do a guest's positions come from?

This was "Should guests see the region map?". The note below settled that they do (D8) and
asked how.

> ME: This is problematic, i really want a working demo as this is my poster child. We need to find out if there are solutions to this opening information problem for this visualization and other visualizations. Think about the limitations of the filled default position cache and how we can try to display just the (default?) cache information for guest users without calling lichess. authed users will be able to make lichess calls which may require different functionality. Also investigate if we can store data locally on the vercel server, like how the ecodata json is stored. If not, maybe the guest master openings region graph is just limited to whatever data it can find, censoring further paths.

**What was found (2026-10-02):**

- The cache as it stands has holes a guest would see at once. Walking the map's own tree
  (top p 0.9, k 8) through `position_cache`: plies 0–2 are complete, ply 3 is missing 3 of
  30 blobs, ply 5 is missing 61 of 214, and ply 6 is missing 199 of 387. Some missing
  positions have over 50,000 master games. The pre-fill follows named openings, and the map
  follows popular moves; those are different sets.
- `npm run cache:prefill -- --min-games N` already walks by popularity, so it can fill
  exactly what the map shows. The user runs it.
- Yes, data can ship with the site the way the catalog JSON does. A file in `public/` is
  served by Vercel's CDN: no function call, no database read, no Lichess. The whole cache
  today (about 6,700 positions) is about 1 MB in a compact form, before compression.
- Reading the cache through the explorer route works too, but costs one function call, one
  database read and one usage write per blob. One guest zooming around makes hundreds.

**Recommendation:** ship a snapshot file, and censor past it.

1. The user runs the pre-fill with `--min-games` (500 or 1000 to start).
2. A new local script writes the cached positions reachable through moves with at least
   that many games to a compact JSON file in `public/`. It is generated, never hand-edited,
   and rebuilt whenever the cache has grown.
3. The map's loader reads the snapshot first, for everyone. A guest's blob with no snapshot
   entry is sealed, drawn in its own style with a line saying an account goes deeper. A
   signed-in user's falls through to the explorer route, as now.
4. The page opens to guests (changes `deployment.md` D17 and D18).

This also gives every visitor the same map, which is what the atlas needs later (D7).

> ME:

### Q2. Is the page called "Regions" or "Labyrinth"?

**Recommendation:** "Labyrinth", if D7's name is meant for visitors and not only for us. The
button, the page title and the address (`/dashboard/visualizations/regions`) all say
"Regions" for now, as the steps below were written. The code keeps "region" either way.

> ME:

## Steps

### Phase 3. Prototype shell

- [x] Add a "regions" view to `src/components/lab/LabHarness.tsx`, loaded with
      `next/dynamic` (`ssr: false`) like the other two views, a page at
      `src/app/dashboard/visualizations/regions/page.tsx`, and a `prototype` entry in
      `VISUALIZATIONS`.
- [x] Add `src/components/lab/LabSpinner.tsx`, and use it for every tab's first load in place
      of the "Loading…" text.
- [x] Move the page's 200 ms stats `setInterval` into `src/components/lab/LabStats.tsx`, so
      only the stats panel re-renders. Each tab writes into a shared stats ref.
- [x] Add FPS and nodes-drawn stats to `ChessMap`.

### Phase 4. RegionMap core (no focus or pins yet)

- [x] `src/lib/regions/camera.ts`: the floating-origin camera, which re-anchors when the frame
      blob changes. Test that re-anchoring leaves screen points fixed.
- [x] `src/lib/regions/visibility.ts`: the frame blob, display depth, fade-in and minimum
      pixel size. Only on-screen blobs are computed.
- [x] `src/lib/regions/store.ts`: the blob tree the view reads, filled by `layout` and
      `loader`.
- [x] `src/components/lab/RegionMap.tsx` and `regionRender.ts`: Canvas 2D drawn in an
      animation loop with a dirty flag, hand-written pointer handling, walls, labels, the
      "Other" reveal, and cleanup on unmount. Also `src/lib/regions/labels.ts`, which
      decides the labels.
- [ ] **User check-in on look and feel**, signed in, at `/dashboard/visualizations/regions`.
      It includes a yes or no on the three changes to the design (Notes).

### Phase 5. Focus

- [ ] `src/lib/regions/windows.ts`: the window, corridor and chain rules, with tests.
- [ ] The focus UI (click to focus or unfocus), and the zoom-in block at sealed frames.

### Phase 6. Pinning

- [ ] `src/lib/regions/pins.ts`: the fit path and the carve fallback, splitting free space
      into pieces, and assigning siblings to them, with tests.
- [ ] Shift+click to pin, size-function tints, and the largest share error in the stats.
- [ ] **User check-in.**

### Phase 7. Sidebar and final pass

- [ ] Sidebar controls, Reshuffle, and the re-layout spinner.
- [ ] Final docs pass: `region-map.md`, `lab-prototypes.md`, and the `d3` row under "Kept on
      purpose" in `AGENTS.md`, since `RegionMap` uses `interpolateZoom`.

### Manual checks (`npm run dev`, `/dashboard/visualizations`)

- [ ] After opening all three prototypes in turn, no animation loop is still running
      (DevTools Performance).
- [ ] The spinner shows on first load and after changing p.
- [ ] Zooming to depth 10 shows wall hatching.
- [ ] After focusing a depth-8 blob, you can zoom 10 layers below it.
- [ ] After unfocusing a middle link of a chain, the corridor stays open.
- [ ] After pinning a blob and changing p, the pinned blob keeps its place and its siblings
      refresh.
- [ ] "Other" can be revealed twice and is then sealed.
- [ ] Reloading gives the same map, and Reshuffle gives a new one.

## Notes

- Master games thin out past about 15 plies in sidelines, so many branches end before the
  depth limit. Expect that during the depth-10 check.
- If the deployment plan's performance setting lands (deployment Q4), Lite mode could lower
  the region map's display depth. That isn't part of this plan.

**Changes to the design, made in Phase 4 and waiting on the check-in.** Each is written up
in `docs/design/region-map.md`.

- The layer fade. The design faded one extra layer by the leading child's coverage. That
  pops: when a child becomes the frame, the layer below its own leading child appears at
  once. Now each blob earns the next layer by its own coverage, which is continuous and is
  tested. The cost is that down a line of main moves a fourth layer, and sometimes a faint
  fifth, shows inside the blob being zoomed into.
- Labels. A main move sits on its parent's centre, so their labels landed on each other.
  Of two such labels the one nearer a readable size shows, and they trade places as the
  view zooms. A blob far larger than that size carries its label as a watermark.
- The zoom-in block also applies in the empty padding between a frame's children, not only
  in a sealed frame, since zooming on there shows nothing.

**Checked without a sign-in.** Phase 4 was checked in a standalone build of `RegionMap` fed
from a local, read-only copy of `position_cache`. It has not been seen inside the app's own
page, in a browser other than Chrome, or on a touch screen.
