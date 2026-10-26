# Master books

Status: deciding · Updated: 2026-10-26 · Depends on: bookstore.md, game-history.md

**Goal:** a repeatable pipeline that gathers a master's or influencer's public online games,
measures how well candidate books would fit them, and turns the chosen ones into Bookstore
books people can use to play like that player.
**Done when:** the user can ask for a set of books about a player (say their 1.e4 games as
White, or their Najdorf as Black), and a batch run gathers the games, reports measurements
that settle the parameters, grows the books, measures their fit, and leaves drafts in the
publishing account for the user to review and publish.

This is the "Played by masters" work that `bookstore.md` D24 sends to a plan of its own. The
first trial, ten drafts from four players, is in `bookstore.md` under Q1 ("Player books,
tried").

## Decisions

- D1. **A book is grown from a player's games, never presented as the player's work** (the
  user, 2026-10-26: "I dont want to make it seem like masters, especially recently deceased,
  had a hand in these books"). Its name says whose games it came from ("Hikaru games · …"), and
  its description says the player had no part in making it.
- D2. **The games are public online games from Chess.com and Lichess.** Lichess's masters
  database can't be filtered by player, so it can't say what one player plays. It stays useful
  as a second measure: how many master games a book covers.
- D3. **The pipeline has these stages** (the user's sketch, 2026-10-26):
  1. Gather a player's games from both sites, locally or on a server, and show progress.
  2. Analyse them: how sharp or flat the player's choices are, by speed, time span and color.
  3. Report the measurements in a form that helps the user pick each book's parameters.
  4. Grow the books with those parameters.
  5. Measure how well each book reflects the player's actual games.
  6. Save the books as drafts for review, many at a time, in batch jobs run when the server
     isn't busy.
- D4. **No stage runs in a Vercel function.** Gathering, growing and measuring walk trees and
  scan games, which `plans/deployment.md` D1 and AGENTS.md's data rules keep out of functions.
  Q7 asks where they run instead.

## Open questions

### Q1. Which of a player's games count?

Speeds (bullet, blitz, rapid, classical), the time span, rated or casual, the opponents'
strength, and whether the two sites' games are merged.

**Recommendation:** default to blitz and rapid from the last three years, rated only, standard
chess only, both sites merged. Measure bullet separately and add it only when it doesn't change
the player's choices much. Report every split side by side (Q6), so each choice is made from
numbers and recorded per book. Events like the Speed Chess Championship can't be picked out:
Chess.com tags them "Live Chess", so a stand-in such as "opponents rated 3000 or more" is the
closest filter.

> ME:

### Q2. How do we know who played which color, and keep the filter from skewing the book?

The trial's Rosen gambits White book shows the Benoni as the most common reply to 1.d4, which
is probably not true of Rosen's games. The likely cause is selection, not swapped colors: the
filter kept only games that reached a gambit Rosen offered. The catalog names several White
gambits after 1.d4 c5 ("Benoni Defense: Benoni Gambit Accepted", "Zilbermints-Benoni Gambit",
"Benoni-Staunton Gambit"), so games where the opponent answered 1...c5 passed far more often
than games with 1...d5 or 1...Nf6. Choosing games by where they ended up skews every move
before that point. Swapped colors still need ruling out.

**Recommendation:**

- **Color:** take it only from the PGN's White and Black tags matched to the player's account
  name (ignoring case, and listing every account the player has used). Check it with a test of
  known games, and have the report show the player's first-move split as White and as Black,
  where a mistake would stand out.
- **Filters:** choose games only by the player's own moves ("played 1.d4 as White", "answered
  1.e4 with 1...c5"), never by a later position or the result. A gambit book first picks the
  gambits (the player's move at a given position), then grows from every game that passed
  through those positions, with the opponents' replies counted from all of them.

> ME:

### Q3. How many moves does each side keep at a branch?

The user (2026-10-26) wants to try the player's side at top k 1 or 2 depending on the
distribution, with the opponents' side looser, around top p 0.8 with k 3 or 4. The trial used
top p for the player's side and a share floor for the opponents' side.

**Recommendation:** for the player's side, keep the most played move, and the second only when
it is played at least some fraction as often as the first (start at 40%), so a sharp player
gets one move and a player torn between two gets both. For the opponents' side, keep moves up
to top p 0.8, at most 4, each above a minimum number of games. Run the trial's books again at a
few settings of each and compare them in the report before picking defaults.

> ME:

### Q4. When does expanding a branch stop paying off?

The user wants to see what goes into the decision at each branch, such as how a flattening
distribution shows that expanding further is futile.

**Recommendation:** at each position, measure the games that reach it, the share the top move
takes, and the effective number of moves (2 raised to the entropy in bits: 1 when one move is
always played, about 4 when four moves split evenly). Stop a branch when the coverage it would
add per position falls below a threshold, or when fewer games than the minimum reach it. A
flat position (many rare moves) then stops sooner than a sharp one with the same games. Label
each line's end with why it stopped (too few games, too flat, the length limit, the budget) so
the report can show where the book is thin and why.

> ME:

### Q5. How do we measure how well a book reflects the player?

**Recommendation:** lead with a held-out check. Grow the book from older games and measure it
on the most recent months, so a book that only memorized its own games scores lower. Report:

- the share of the player's games that reach a line's end, and the average plies they stay in
  the book;
- at the player's positions in the book, how often the book's move is the one they played;
- who leaves the book first, the player or the opponent;
- how sharp or flat the player's own choices are, overall and by speed;
- master-games coverage (D2), as a second measure.

> ME:

### Q6. What should the report look like?

**Recommendation:** two outputs from one run. The console prints a table per book, with one row
per parameter setting tried (the trial's table, plus the Q5 measures). A standalone HTML page
draws curves for each book: coverage against positions, line length against width, and one
row per stopping reason. A mockup comes first, in `plans/mockups/`.

> ME:

### Q7. Where do gathering and batch jobs run, and what gets stored?

The trial ran locally. Hikaru's Chess.com games alone were 76 MB of PGN. A Lichess export sends
20–30 games a second, so a 15,000-game player takes about ten minutes, and Chess.com goes month
by month.

**Recommendation:**

- **Where:** keep it a local script for now, then run batches on a schedule (a scheduled
  GitHub Action, or the user's machine overnight). Neither touches Vercel (D4).
- **What's stored:** keep per-player move counts by position, split by speed, month and
  color, instead of the PGN. A rerun with new parameters then downloads nothing, and an update
  fetches only the months since the last run.
- **Where it's stored:** where the counts live (files, a private bucket, or a table) waits on
  their size. Any table would be a migration the user runs.
- **Manners:** stay within each site's limits, identify the script with a user agent that names
  the project, and back off on a 429, as `buildPlayerBooks.ts` already does.

> ME:

### Q8. Which players, and what may we publish?

**Recommendation:** start with players whose openings people search for: streamers, and top
players with large online game counts. Before anything is published, check each site's terms
for reusing games and naming players (not yet checked), and decide how a player can ask for a
book to be taken down. Prefer living, active players whose current repertoire the games show.

> ME:

### Q9. How does the user ask for books, and how do they stay current?

**Recommendation:** a list of book specs, one per book, separate from the script: the player
and their accounts, the color, the root moves, the game filter (Q1, Q2), the branching
parameters (Q3, Q4) and the budget. The user names the books, an agent adds the specs, and one
batch run builds them all. A published book records the span of games it came from. A refresh
publishes a new edition, and readers keep the copy they saved.

> ME:

## Steps

Written once the open questions are settled.

## Notes

**Experiments the user asked for (2026-10-26)**, which can run before the questions settle:

- The player's side at top k 1 or 2, depending on the distribution, and the opponents' side at
  top p 0.8 with k 3 or 4 (Q3).
- A per-position printout of the measures in Q4 along a few lines, to see where flattening
  ends a branch.
- The Rosen gambit books rebuilt with a filter that uses only Rosen's moves (Q2), to confirm
  the Benoni came from the selection.

**What exists:** `npm run books:players` (`scripts/buildPlayerBooks.ts`) downloads and caches the
games, counts the player's moves by position (`src/lib/books/playerGames.ts`), grows books with
`growBook`'s top p option, fits each to a position budget, measures coverage, and saves drafts
to the publishing account (`src/lib/db/publishing.ts`). `-- --store <slug>` publishes a draft
to the Bookstore as a static file in `public/books/players/`. Four were published on 2026-10-26
at the user's request: Rosen gambits Black, Naroditsky KID tight, Hikaru White tight and Hikaru
vs 1.e4 tight. Q8's terms check hadn't been done then. The site addresses are in
`src/lib/history/fetchGames.ts`, shared with `game-history.md` step 24. The trial's books are
defined at the top of the script.

**Lessons from the trial:**

- A wider top p catches more of the player's games but spends the budget on breadth, so the
  lines get shorter.
- When most books ran into the 1,000-position limit, their lines were all about one length.
  Per-book budgets, with the fewest games a move needs fitted to the budget, fixed that.
- Master coverage is low for narrow books, because online opponents reply differently from
  masters and `position_cache` stops short of many deep positions.
- A game's opening has to be its deepest catalog name. "King's Indian Defense" is already named
  at 3.Nc3, before Black has chosen it over the Grünfeld.
