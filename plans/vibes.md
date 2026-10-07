# Vibes

Status: deciding · Updated: 2026-10-07 · Depends on: deployment.md

**Goal:** the UI around the board takes on a vibe chosen for the opening being shown, growing
richer the deeper the line goes, with music to match, and the community votes on which
opening gets which vibe.
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
- D2. **The base UI stays.** Users who want no vibes keep the base UI with its color modes.
  A color mode never blends into a vibe; it is the no-vibes experience.
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

## Open questions

### Q1. Which UI framework is the base?

The user's question (2026-10-07): the current UI or shadcn/ui, judged by how well each
takes changes that come and go with the position. What vibes need from it:

- Changes land many times a minute as the user steps through a line, so a change must cost
  a style update, not a re-render of the page.
- Layers fade in and out by depth, so every visual property must be reachable from CSS and
  able to transition.
- Vibes add ornaments (borders, corner pieces, textures) to buttons, cards and the sidebar
  without each component knowing about vibes.
- Nothing may move. A vibe that changes a panel's padding shifts the board under the
  pointer, the same kind of loop as the Spine view's hover jitter.

**Recommendation:** shadcn/ui. Its components are source files in the repo, every part
carries a `data-slot` attribute (`card`, `card-header`, `button`), and every color, radius
and shadow is a CSS variable. A vibe is then a stylesheet keyed on attributes of `<html>`
(the vibe, the subvibe and the depth) that targets those slots, with no change to the
components, and switching vibes is one attribute write. The current UI uses the same
mechanism (Tailwind plus tokens) only in part: many classes are hard-coded and nothing marks
a component's parts for a stylesheet to find, so it would need the same retrofit by hand.
Libraries that theme at runtime (MUI, Mantine, Chakra) fit worst, since their themes are
JavaScript objects and a vibe change re-renders the tree. Either way, the first phase of
this plan makes every visual value a token.

> ME:

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
  frame around it takes part in the vibe.
- Pages without a board use the base UI.
- New visitors get vibes on and music off. Browsers block sound until the user presses
  something anyway, and sound that starts unasked drives people away. A music button sits in
  the header.
- Settings: vibes on or off, music on or off with a volume, and a cap on layers for people
  who want a calmer page. Moving ornaments stop when the system asks for reduced motion.

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

## Steps

Drafted in plan mode once Q1–Q9 are answered. The likely phases are in Notes.

## Notes

**Layers without layout shift (Q1).**

- A vibe changes paint, never size: colors, borders drawn inside boxes, backgrounds,
  ornaments laid over the frame, and fonts with matched metrics so text keeps its width. A
  browser test can check that the board and panels keep their boxes in every vibe and layer.
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

1. The base UI on the chosen framework, with every visual value a token (Q1).
2. The vibe engine: anchors, finding the vibe (Q4), the attribute writer, two hand-built
   vibes on a fixed assignment, and the layout-shift test.
3. Music: the loop engine and one vibe's tracks.
4. Ranks, ballots, the visitor route, the tally job, and the leaderboard with its countdown.
5. The first voting period, after which the user publishes the first assignment.
