# Region map

Status: ready · Updated: 2026-10-01 · Depends on: —

**Goal:** finish the Regions prototype on the Visualizations page, a zoomable 2D map in which
every move is a pebble-shaped region inside its parent move's region.
**Done when:** phases 3–7 below are checked off and the manual checks pass in `npm run dev`.

## Decisions

- D1. The design in `docs/design/region-map.md` was settled on 2026-09-29 and is
  binding. This plan tracks only the remaining build. Before starting a phase, read that
  doc's sections on the pieces the phase builds.
- D2. Phases 0–2 are done: the design record, Vitest with the pure geometry and its property
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

## Open questions

### Q1. Should guests see the region map once the site is public?

**Recommendation:** not at first. Keep the Lab hidden from guests until the catalog cache
pre-fill (deployment Q3) exists. The region map makes one explorer lookup per blob, so a
guest zooming around could trigger hundreds of Lichess calls on the user's token. No other
part of the app uses Lichess as heavily. Hiding the Lab is already listed under
"Before going public" in `deployment.md`.

> ME: This is problematic, i really want a working demo as this is my poster child. We need to find out if there are solutions to this opening information problem for this visualization and other visualizations. Think about the limitations of the filled default position cache and how we can try to display just the (default?) cache information for guest users without calling lichess. authed users will be able to make lichess calls which may require different functionality. Also investigate we can store data locally on the vercel server, like how the ecodata json is stored.

## Steps

### Phase 3. Prototype shell

- [ ] Add a "regions" view to `src/components/lab/LabHarness.tsx`, loaded with
      `next/dynamic` (`ssr: false`) like the other two views, a page at
      `src/app/dashboard/visualizations/regions/page.tsx`, and a `prototype` entry in
      `VISUALIZATIONS`.
- [ ] Add `src/components/lab/LabSpinner.tsx`, and use it for every tab's first load in place
      of the "Loading…" text.
- [ ] Move the page's 200 ms stats `setInterval` into `src/components/lab/LabStats.tsx`, so
      only the stats panel re-renders. Each tab writes into a shared stats ref.
- [ ] Add FPS and nodes-drawn stats to `ChessMap`.

### Phase 4. RegionMap core (no focus or pins yet)

- [ ] `src/lib/regions/camera.ts`: the floating-origin camera, which re-anchors when the frame
      blob changes. Test that re-anchoring leaves screen points fixed.
- [ ] `src/lib/regions/visibility.ts`: the frame blob, display depth, fade-in and minimum
      pixel size. Only on-screen blobs are computed.
- [ ] `src/lib/regions/store.ts`: the blob tree the view reads, filled by `layout` and
      `loader`.
- [ ] `src/components/lab/RegionMap.tsx` and `regionRender.ts`: Canvas 2D drawn in an
      animation loop with a dirty flag, hand-written pointer handling, walls, labels, the
      "Other" reveal, and cleanup on unmount.
- [ ] **User check-in on look and feel.**

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
