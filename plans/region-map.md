# Region map (the Labyrinth)

Status: active · Updated: 2026-10-03 · Depends on: —

**Goal:** finish the Labyrinth, the region map prototype on the Visualizations page: a
zoomable 2D map in which every move is a pebble-shaped region inside its parent move's region.
**Done when:** phases 3–7 below are checked off and the manual checks pass in `npm run dev`.

## Decisions

- D1. The design in `docs/design/region-map.md` was settled on 2026-09-29 and is
  binding. This plan tracks only the remaining build. Before starting a phase, read that
  doc's sections on the pieces the phase builds.
- D2. Phases 0–2 are done: the design record, Vitest with the pure geometry and its property
  tests, and the data layer (explorer route and cache changes, `fenAfterUci`, `selection`,
  `loader`).
> ME: worth noting that the png that we produced looks like it contains 4 layers in many points. sticking to 3 layers from frame blob will hopefully preserve readability. The test pmg is quite the beauty though.
- D3. Every phase ends with the typecheck, lint and tests. The user checks in after phases 4
  and 6, and the agent suggests a commit at each check-in.
- D4. Docs that describe code are updated in the same phase as the code.
- D5. The Lab page is gone (`deployment.md` D18). Each prototype has a page under
  `/dashboard/visualizations/` and an entry in `VISUALIZATIONS`. *Amended 2026-10-02,
  waiting on Q5:* the region map was a view of `LabHarness`; for the title and panel the
  check-in asks for, it now has its own page frame, `RegionMapView`.
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
- D9. The page is the **Labyrinth** (the answer to Q2, "Regions or Labyrinth?"): button,
  title and address `/dashboard/visualizations/labyrinth` (the old one redirects). The code
  keeps "region". The atlas has a draft plan, `atlas.md`, which holds the rest of that
  answer. The opening tree once called the Atlas is now the **Treemap**.
- D10. A guest's map never reaches Lichess, and should cost as few function calls and
  database reads as it can (from the answer to Q1). The popularity pre-fill starts at 1000
  games (`npm run cache:prefill -- --min-games 1000`, run by the user), and later runs lower
  that number.

## Open questions
> ME: keep in mind the fact that we are creating something of a dynamic version of the region map, call it the labyrinth; as opposed to the static version, the atlas, that will be more similar to google-maps detail oriented static map behavior. Both zoom deep, both have many similar functionalities, but the atlas will be slightly further in the future and may be subject to computation shortcuts because we may be able to prerender it like it's predetermined. And way way down the line, maybe we could even add current games that are happening as pins on the atlas map.
### Q1. Ship the guest snapshot file?

Was "Where do a guest's positions come from?". D8 and D10 hold what is settled.

> ME: This is problematic, i really want a working demo as this is my poster child. We need to find out if there are solutions to this opening information problem for this visualization and other visualizations. Think about the limitations of the filled default position cache and how we can try to display just the (default?) cache information for guest users without calling lichess. authed users will be able to make lichess calls which may require different functionality. Also investigate if we can store data locally on the vercel server, like how the ecodata json is stored. If not, maybe the guest master openings region graph is just limited to whatever data it can find, censoring further paths.

**Found:** the pre-fill followed named openings and the map follows popular moves, so the
cache had holes a guest sees at once. A dry run at 1000 games (2026-10-02) found the catalog
fully cached and at least 733 more positions missing (a lower bound: a dry run can't see
past a missing position).

> ME: Whats a snapshot file? I agree with your idea of collecting all positions with at least a certain number of visits, lets start with aquiring positions that have at least 1000 visits (from previous position) and make plans to reduce that number on future runs. Does the snapshot go to users once, reducing function/db calls? that would be nice. If all guests could use the region map as it stands and made hundreds of function/db calls, all symiltaniously, that would probably slow the server down quite a bit right? I do like the idea of opening regions in a limited way to guests with regard to limiting lichess calls, function calls, and db calls.

**Answers.** The snapshot is one JSON file of master-game numbers, written by a local script
from `position_cache` after each pre-fill run, for every position the map shows down to the
threshold. It ships in `public/` like a picture does (about 1 MB for 6,700 positions, before
compression). Yes, it goes to each visitor once: the browser keeps it, and the CDN serves it
with no function call, database read or Lichess call. Hundreds of live calls per guest would
less slow the server than spend its allowance: each is a function call, a cache read and a
usage write, and the free tiers cap those.

**Recommendation:** yes. The loader reads the snapshot first, for everyone; a guest's blob
past it is sealed, saying an account goes deeper; a signed-in user's falls through to the
route as now; and the page opens to guests (changes `deployment.md` D17 and D18). It is not
atlas data, which needs a date cutoff (`atlas.md`, Q1).

> ME:

### Q3. The engine size function: when, and how?

> ME: We might want to consider adding a simple loading animation for nodes that are waiting for data. We should also start considering the engine eval version of the choice-/size-of-blob display function. This will allow us to handoff blob display from master games to engine eval when needed, like at the limit of the position cache and snapshot for guests. My first thoughts on this are that engine blobs will be different in that: they will be more dynamic, they will not have as many level 2 children after one level if we use just the regular 3 engine lines in the explorer. Solving these issues may require a two tier process for blob display, namely: an engine searching process that uses a discrete amount of time and depth to investigate individual blobs before it makes a recommendation for display, locking in its choice after making it; and the actual blob display function that partitions the generated children in a way that reflects the engines preference, not necessarily tied to the evaluation number, i.e. "great"/"only" moves blobs should take up a large majority of the child space, while positions containing moves with around the same preference (regardless of good or bad eval rating) will give more even partitions. Another challenge we will face is the fact that many of these engine line blobs will converge, more so than openings, Ill have to investigate that when I get there.

The loading animation is built (Phase 4). **Thoughts on the rest:** Stockfish runs only in
the browser, so a locked-in search result could be saved per position in `position_evals`.
Weighting each move by how far it falls below the best, say exp(−loss / T), gives an only
move nearly all the space and splits it evenly between moves of similar strength, good
position or bad. Asking for 5 to 8 lines with the rest in "Other" matches the master map.
Engine blobs need their own look (`architecture.md`), which Q4 should cover.

**Recommendation:** after Phase 7, in its own plan, starting from a pure share function with
property tests.

> ME:

### Q4. Which look means what on a blob?

The book selector is in place, but highlighting a book's lines waits on this (check-in note
under Phase 4). **Taken now:** white or black edge and fill (the side that moved), edge
thickness (layers below the frame), long dashes ("Other"), travelling dots (loading),
hatching (the depth limit). **Planned:** thick edge with a glow (focus), double edge (pin),
a cream-brown or green tint (size function).

**Recommendation:** a book's moves get an emerald inner outline (as on the Treemap) just
inside the edge, which keeps meaning the side. "Can't go deeper" stays hatching, since
dashes mean "Other". Settle this before Phase 5 adds focus and pins.

> ME:

### Q5. Is the Labyrinth's own page frame OK (D5 as amended)?

**Recommendation:** yes. It shares the harness's spinner, stats and error boundary.

> ME:

## Steps

### Phase 3. Prototype shell

- [x] A lazily loaded view with its own page and `VISUALIZATIONS` entry (since moved to its
      own frame, D5), `LabSpinner`, `LabStats`, and FPS and nodes-drawn stats in `ChessMap`.

### Phase 4. RegionMap core (no focus or pins yet)

- [x] `camera.ts` (floating origin, tested), `visibility.ts` (frame, display depth, fade-in,
      minimum size), `store.ts` (the blob tree), `RegionMap.tsx` and `regionRender.ts`
      (Canvas 2D, dirty flag, pointer handling, walls, labels, "Other", cleanup), `labels.ts`.
- [ ] **User check-in on look and feel**, signed in, at `/dashboard/visualizations/labyrinth`.
      It includes a yes or no on the three changes to the design (Notes).
      > ME: I think the "other" word doesnt dissapear after we click it. The "other" word should disappear because the "other" blob is being split into multiple blobs (most of the time) which have their own move labels. I just checked the regions on mobile, works very well but the metrics sidebar needs to be collapsable. Also its a little too hard to understand which moves are black and white, could we make the region coloring a little more opaque? This will cause more "checkering" in the whole display
      > ME: Great Idea here: the current frame blob is displayed as the title of the window, above the window. Ex: frame blob comes from the move order 1.e4,e5 2.nf3,nf6 would make the title the petrov, with the move order underneath (I say this because the dynamic move order string (0-30+ moves) would make displaying the title change too much). Along with the title being on top, the metrics sidebar should change to be the same as the sidebar on what is currently (misnamed as) the atlas. Board, game stats, add to book, etc. I guess this would mean adding the current book somewhere as well, I am kind of a fan of it being on the top like the current atlas so I guess do that. The only thing is that it needs to be slightly modified in a way that doesnt make it the center of attention. Another quick addition would be that move changes to both of these sidebar board positions should have a little animation to show the pieces moving or unmoving. This already exists on parts like the explorer playthrough functionality. Examples of actions: Zooming would change the frame blob, causing corrosponding changes in the right sidebar and title; picking a book/repetoire would highlight the edges of the blobs on the display that are within that book/repetoire (not entirely sure how blob aspects should display yet, we need to decide on which aspects mean what, like dashed lines within the blob meaning the user cant go deeper and colored edges means a move with black or white, etc)
- [x] (agent, 2026-10-02) From those notes: "Other" loses its label once opened; stronger
      fills, so the map checkers; the opening's name above the map with the moves under it;
      the Treemap's panel (board, master games, Add or Remove from book, Open in Explorer,
      Train) with a small book selector in the title bar; the stats in a closed section of
      the panel; a Show or Hide panel button, closed by default on a phone; pieces that
      slide on both panels' boards; travelling dots on blobs that are loading (Q3's note);
      and the renames in D9.
- [ ] Highlight the chosen book's lines on the map. Waits on Q4.
- [ ] **User re-check** of the line above, signed in.

### Phase 5. Focus

- [ ] `src/lib/regions/windows.ts`: the window, corridor and chain rules, with tests.
- [ ] The focus UI (click to focus or unfocus), and the zoom-in block at sealed frames.

### Phase 6. Pinning

- [ ] `src/lib/regions/pins.ts`: the fit path and the carve fallback, splitting free space
      into pieces, and assigning siblings to them, with tests.
- [ ] Shift+click to pin, size-function tints, and the largest share error in the stats.
- [ ] **User check-in.**

### Phase 7. Map controls and final pass

- [ ] The map's controls in the panel's "Map stats and controls" section, Reshuffle, and
      the re-layout spinner.
- [ ] Final docs pass: `region-map.md` and `lab-prototypes.md`. If the Fit and Zoom buttons
      use d3's `interpolateZoom`, also the `d3` row under "Kept on purpose" in `AGENTS.md`,
      and `interpolateZoom` leaves the planned list in `docs/docs.test.ts`.

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

**Changes to the design, waiting on the check-in** (written up in
`docs/design/region-map.md`): each blob earns its next layer by its own coverage, so a faint
fourth layer can show down a main line; a main move's label and its parent's trade places as
the view zooms; and zoom-in also stops in the empty padding between a frame's children.

**Checked without a sign-in:** Phase 4 in a standalone build, the 2026-10-02 fixes in a
temporary guest copy of the page (removed) in headless Chrome at 1400×850 and 390×780. Not
yet seen signed in, in another browser, or on a real touch screen.
