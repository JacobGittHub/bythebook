# Vibes

Status: deciding · Updated: 2026-10-14 · Depends on: deployment.md, book-ui.md

**Goal:** the book the app is drawn as (`book-ui.md`) takes on a vibe chosen for the opening
being shown, growing richer the deeper the line goes, with music to match, and the community
votes on which opening gets which vibe.
**Done when:** one voting period has run end to end (members and visitors voted, and the user
published assignments from the tally), and with vibes on, every page with a board shows the
assigned vibe and its music, layered by depth, while the base UI stays one switch away.

## Decisions

From the user's message of 2026-10-07.

- D1. **Vibes follow the position.** Wherever the app shows a position on a board (the
  Explorer, the visualizations, the Bookstore's detail view, later the trainer), the UI
  around it takes on the vibe of the opening that position belongs to. People already
  associate openings with moods, and a vibe is one more cue that makes an opening a place
  (the product goal in `AGENTS.md`).
- D2. **The base UI stays, in light and dark.** Settings has a theme (light, dark, or the
  system's) and a vibes switch; with vibes off, the base UI is the whole experience. The five
  background colors went on 2026-10-12, since every vibe in every layer is tested against
  every base: a vibe comes in a light and a dark version of its colors, and shares its art
  between them.
  *Amended 2026-10-14 (D14):* the vibes switch moves to the strip above the book, beside the
  account links; Settings keeps one too.
- D3. **The community votes; the user decides.** Votes are input. The user assigns vibes to
  openings, and can change the vibes and restart the voting timer at any time.
- D4. **Three ranks.** Visitors are guests, members are beta accounts, and the user holds
  the top rank (its name is Q9). Member and visitor votes are tallied separately. Only member
  votes inform the decision, and the voting pages say so plainly, because anyone can fake
  visitor votes in bulk.
- D5. **Voting is secured like sign-in.** A member's ballot is accepted only from a
  signed-in session, checked on the server. Visitor ballots from a repeated network identity
  are dropped (Q5). The visitor tally refreshes about once an hour at a random time, so
  nobody can vote, watch the tally and learn which of their ballots got through.
- D6. **Voting periods last a month**, with a countdown on the vibe leaderboard. The user
  can end a period and restart the timer at will.
- D7. **A ballot gives vibes to a fixed list of openings.** We choose the openings on each
  ballot. Any part of a ballot may be left empty.
- D8. **Subvibes, placed by anchor positions.** The user committed to subvibes on
  2026-10-07. An anchor is a chess position where a vibe or a subvibe starts, and the same
  anchors are used every period. Below an anchor, depth adds layers: shallow positions
  show few vibe elements and few instruments, deep positions show more. A branch's anchor
  adds its subvibe's layers on top of the parent vibe, so moving between related lines adds
  or removes layers instead of swapping the whole UI, which is easier to switch on demand.
- D9. **Some anchors switch at once.** A line that changes the game's character, such as
  the King's Gambit appearing after 1.e4 e5, replaces the vibe immediately instead of
  layering into it.
- D10. **Music.** Each vibe has a background loop built from instrument tracks, which follow
  the same layers as the UI: depth and subvibes add and remove instruments.
- D11. **The visualization windows don't change, for now** (carried from 2026-10-06). Vibes
  restyle the surroundings: the frame, buttons, fonts, sidebar and cards. The book views,
  the Treemap and the Labyrinth keep their own colors.
  *Amended 2026-10-14 (D14):* what a vibe restyles is now the book, not the frame around it.
  The visualization windows still keep their own colors.
- D12. **shadcn/ui is the base UI** (was Q1, answered 2026-10-07: "shadcn/ui is great"). Vibes
  need a change of vibe to cost a style update, not a re-render, since it lands many times a
  minute; every visual property reachable from CSS so layers can fade by depth; ornaments
  added to buttons, cards and the sidebar without each component knowing; and a layout that
  never moves. Ornaments are decoration and may animate (a bus driving along the top, a flag
  that waves once), but they stop when the system asks for reduced motion and never cover the
  board or text being read. shadcn/ui's components are source files in the repo, every part
  carries a `data-slot` attribute, and every color, radius and shadow is a CSS variable, so a
  vibe is a stylesheet keyed on attributes of `<html>` that targets those slots, and switching
  is one attribute write. The old UI hard-codes many classes and marks no parts.
  Runtime-themed libraries (MUI, Mantine, Chakra) fit worst, since a theme change re-renders
  the tree. The Library and the Bookstore moved first (`deployment.md` Phase 5b); the rest
  moves in this plan's first phase, which also makes every visual value a token.
  *Amended 2026-10-14 (D14, D15):* ornaments go on the book's areas, not on the sidebar or
  the frame, and the first vibes have none that move.
- D13. **Vibes reach past color** (from the user's sketch of the Explorer, 2026-10-12). Vibes
  start with color, texture, font and material, then grow into images and elements: a
  backdrop behind the frame, the sidebar, the panels that hold everything, and the elements in
  them (buttons, inputs, the move bars) down to their edges. These areas are where the base UI
  leaves room today, not a fixed list. Elements that carry meaning keep it: the move bars'
  white, draw and black stay light, middle and dark in every vibe.
  *Amended 2026-10-14 (D14):* the backdrop and the sidebar are no longer vibe areas; the
  book's are. The rest of D13 holds.

From the user's message of 2026-10-14, when the app became a book (`book-ui.md`).

- D14. **A vibe dresses the book, not its surroundings.** A vibe changes the book as a
  whole: the paper's texture and color, decorative borders on the page, the fonts on the
  page, corner roundness, the cover, and drawings in the margins, like pencil notes in a
  real book. It leaves the strip, the tabs, the account links and the desk alone; a page's
  own bookmark, and in the one-page form its own tab, are cut from its paper and take it
  (`book-ui.md` D4, D15). The book's
  vibe areas are the cover, the pages, the page edges, the gutter, the running heads and
  folios, and the margins (`book-ui.md` Phase 1). The board's squares and pieces, the move
  bars' meaning and the visualization windows' colors stay as D11 and D13 say. The mockup's
  sample vibe shows the kind of change (`plans/mockups/dashboard-spread.html`).
- D15. **The first vibes are static.** They change how the book looks and nothing on it
  moves. D12's moving ornaments wait until the static vibes work. Q10 asks whether static
  also means no depth layers at first.

## Open questions

### Q2. How are branches voted on?

The problem the user raised: a branch's subvibe depends on its parent's vibe, which nobody
knows until the tally. Four ways around it:

1. **Moods as subvibes.** Every vibe is built with the same small set of moods (say sharp,
   solid, wild and quiet). A ballot gives each main opening a vibe and each branch a mood.
   If the Queen's Gambit Accepted is voted "sharp", it gets whichever vibe the Queen's Gambit
   wins, in its sharp form. The two votes don't depend on each other, so one ballot covers
   both levels, and moods map naturally to instruments (percussion for sharp, pads for
   quiet).
2. **Staged ballots.** One month votes vibes for the main openings; the next votes subvibes
   for the branches of the winners. Each ballot is simple, but branches wait a month, and
   changing a parent's vibe restarts its children.
3. **Conditional ballots.** Voters pick branch subvibes from the vibe they chose for the
   parent. Only voters who backed the winning parent count for its branches, so many votes
   are wasted.
4. **Inherit unless overridden.** Branches inherit the parent's vibe, a ballot may give a
   branch a different vibe outright, and the override wins only by a clear margin.

**Recommendation:** 1 for ordinary branches, and 4 for the few lines that switch at once
(D9), which go on the ballot as openings in their own right. Moods also give the music its
structure: a mood is a set of tracks that every vibe's composer provides.

> ME:

### Q3. What does a ballot hold?

"Uniquely assign a list of vibes to a list of openings" can mean that each opening gets at
most one vibe, or also that each vibe is used at most once per ballot. The second needs at
least as many vibes as openings, and every vibe is a lot of work: art, fonts, and tracks for
each layer and mood.

**Recommendation:** each opening gets at most one vibe, and vibes may repeat. Launch with
about 12 main openings (the most played systems the catalog names), two or three branches
each, 4 to 6 vibes and 4 moods. If the tally gives one vibe too many openings, the user's
view can suggest a spread: the assignment with the most member votes in which no vibe takes
more than a set share, which is a small assignment problem solved exactly in the browser.

> ME:

### Q4. How does a position find its vibe?

**Recommendation:**

- Anchors are positions (`toPositionKey`), so a transposition into an anchor's position
  picks up its vibe.
- The active anchor is the last anchor along the line on the board. Depth counts moves since
  the vibe's root anchor, one layer per move up to the vibe's last layer, and a subvibe's
  layers count from its own anchor.
- Leaving theory holds the vibe at its current layer.
- Going back up the line removes layers the same way. Stepping quickly through moves waits
  about 300 ms before restyling, and the music changes on the next bar.
- Hovering a node in a tree window changes nothing; only the board's position counts.
- Assignments ship as a versioned static file on the CDN (`data-delivery.md` D2), so finding
  a vibe costs no request.

> ME:

### Q5. How are visitor ballots deduplicated?

What can be known about a visitor: their network address, which Vercel passes to the
function, and whatever the browser keeps. A MAC address never reaches a website; it doesn't
leave the visitor's local network. Fingerprinting the browser (fonts, canvas, hardware) is
invasive, raises privacy-law problems, and is still fakeable.

**Recommendation:** one visitor ballot per network address per period, stored as a keyed
hash whose key changes each period (never the raw address), plus a random id kept in the
browser. Add Vercel BotID, an invisible bot check that is free on Hobby, on the ballot route,
and a firewall rate limit (Hobby allows three custom rules). A repeat of either the address
or the browser id is dropped silently, and nobody is told whether their ballot counted.
Households, schools and phone networks share addresses, so some real visitors will be
dropped, which is acceptable for a tally that doesn't count.

This needs a route that guests can write to, which changes the rule in `AGENTS.md` that
every route except the explorer returns 401 to guests. The ballot route would be the second
exception, counted with `recordUsage` like every route.

> ME:

### Q6. What runs the hourly tally?

The tally reads every ballot in a period, which `deployment.md` D1 keeps out of Vercel
functions, and Vercel's Hobby cron runs at most once a day.

**Recommendation:** Supabase's `pg_cron`, which the free plan includes. Every five minutes a
job compares the clock with a stored "next run" time. Once that has passed, it recomputes
the tally into one row per period and group, and sets the next run 30 to 90 minutes ahead at
random. The leaderboard reads that one row, which the CDN can keep until the next run. The
job runs inside the database over at most a few thousand ballots, so its load is bounded,
but it would be the app's first scheduled aggregate, so it waits for the user's approval.

> ME:

### Q7. Where do vibes show, and what is on by default?

**Recommendation:**

- The board's squares and pieces stay the same everywhere, so the board stays readable; the
  pages around it take part in the vibe (D14).
- Pages without a board show the base book.
- New visitors get vibes on and music off. Browsers block sound until the user presses
  something anyway, and sound that starts unasked drives people away. A music button sits in
  the strip, beside the vibes switch.
- Settings: vibes on or off (also in the strip), music on or off with a volume, and a cap on
  layers for people who want a calmer page. Moving ornaments, once there are any (D15), stop
  when the system asks for reduced motion.

> ME:

### Q8. Where does the music come from?

**Recommendation:** original or CC0 music only, since anything else needs a licence for every
track. Each vibe's tracks share one tempo, key and loop length so they can start together
and fade in and out; game composers call this vertical layering. The tracks are compressed
audio on the CDN, loaded only when their vibe first plays. A vibe change crossfades on a bar
line, and an anchor that switches at once cuts over with a short sting. Who writes the music
is the user's call: the user, a commission, or CC0 libraries.

> ME:

### Q9. What is the top rank called?

The user asked for a library title with a king's air.

**Recommendation:** Grand Librarian, shown with a small crown. Others: Head Librarian, Keeper
of the Books, Librarian-King.

> ME:

### Q10. Do the first vibes have depth layers?

D15 makes the first vibes static: nothing on the book moves. Depth layers (D8) are static too,
since each layer adds or removes something as the line goes deeper, but they make every vibe
several looks instead of one.

**Recommendation:** the first two vibes are one look each, with no layers and no subvibes, so
the book's areas, the switch and the contrast tests get proven on something small. Layers
follow in the next step of the same phase, before the music, since the music's layers
follow the vibe's.

> ME:

## Steps

Phase 1 doesn't depend on Q2–Q9, so it started on 2026-10-12. The later phases are drafted
once those are answered; the likely ones are in Notes.

### Phase 1. The base UI on shadcn/ui, every visual value a token (D2, D12, D13)

- [x] (agent) Themes: light, dark and the system's, set before the first paint; the five
      background modes go; a vibes switch in Settings, saved, with no vibes behind it yet.
- [x] (agent) Tokens: shadcn/ui's names for every color, a radius scale from one `--radius`
      that a vibe can override, font tokens for body, headings and numbers; the dark-mode
      patches for fixed classes go.
- [x] (agent) The areas of D13 marked with `data-slot`: a backdrop layer behind the frame,
      the sidebar, the frame and the panels, with their pseudo-elements left free for vibes.
- [x] (agent) A tightening pass, page by page: smaller corners everywhere, less padding and
      fewer boxes inside boxes, most of all in the panels; shadcn/ui's controls in place of
      `btn-*` and the old `ui/Button` and `ui/Badge`; AlertDialog and toasts in place of
      `confirm()` and `alert()`. The trainer and puzzle pages get a minimal port.
- [x] (agent) Docs brought up to date: `docs/design/dashboard.md` § "Theme and vibe areas"
      and the UI rules in `AGENTS.md`.
- [ ] (agent) The screenshot baselines renewed, and the browser tests run, in a review.
- [ ] (user) Check every page in light and dark, wide and at phone width.
- [ ] (user, agent) Record the Overview's demos again (`deployment.md` Phase 7).

*2026-10-14:* the book (`book-ui.md`) replaces the frame this phase built, so these three
open steps would be done twice. If the book comes first (`book-ui.md` Q9), they move to that
plan's Phase 4.

## Notes

**Layers without layout shift (D12).**

- A vibe changes paint, never size: colors, borders drawn inside the pages, paper textures,
  drawings laid in the margins, and fonts with matched metrics so text keeps its width. A
  browser test can check that the board and the page's sections keep their boxes in every
  vibe and layer.
- One CSS variable for depth, registered with `@property` so it animates, drives each
  ornament's opacity through that ornament's own threshold. Layers then fade in and out from
  one value change, in every browser.
- Every text and background pair in every vibe and layer passes WCAG AA contrast. If vibes
  are defined as data, a unit test can check that.

**Anchors (D8).** An anchor holds a position key, a SAN line to check it against, a name from
the catalog, its parent anchor, and whether it switches at once. Each anchor's line must
extend its parent's line, which a unit test can replay. The catalog names the positions, so
anchors need no outside source and nothing to credit (as found in `bookstore.md` Q1).

**Data and load.** A member's ballot is one row per period and member, changed until the
period ends. A visitor's is one row per period and hashed address. Both are single-row
writes (`deployment.md` D1). The tally is one row per period and group, and the assignments
are a static file the user publishes. Ranks become a role on `profiles` that only the
service role can set, like the Bookstore's verified mark (`bookstore.md` D13). A vibe change
costs the server nothing. `load-testing.md` covers the ballot route's load.

**Likely phases.**

1. The rest of the base UI on shadcn/ui, with every visual value a token (D12), now Phase 1
   in Steps.
2. The vibe engine, after the book (`book-ui.md`): anchors, finding the vibe (Q4), the
   attribute writer, two hand-built static vibes on a fixed assignment that dress the book
   (D14, D15), then depth layers (Q10), and the layout-shift test.
3. Music: the loop engine and one vibe's tracks.
4. Ranks, ballots, the visitor route, the tally job, and the leaderboard with its countdown.
5. The first voting period, after which the user publishes the first assignment.
