# Bookstore, repertoires and library files

Status: deciding · Updated: 2026-10-24 · Depends on: deployment.md

**Goal:** give users default books to pick from, repertoires that combine books, and files
that move a library in and out of the app.
**Done when:** a guest can add a default book from the Bookstore, combine books into a
repertoire that opens wherever a book does, export the library to a file, and import it in
another browser.

## Decisions

Carried over from `deployment.md` (D10–D13), where the user settled them.

- D1. A **book** is one opening tree. A **repertoire** is a union of books that covers a
  goal better than one book can, and it is drilled the same way a book is. The **Bookstore**
  is a page where users pick default books such as "Queen's Gambit", "King's Indian Defense
  with Modern" or "Gambits". Users also make their own books and repertoires.
  *Amended 2026-10-06 (D11):* a repertoire is a book that scores high on the book–repertoire
  scale, and Combine makes one from several books.
  > ME: bookstore books (assume repetoires as well) will have no user statistics like success rates in positions, obviously. We will allow users to rate bookstore books. Some bookstore stats I think we should display for every book are the title (we may want to add a small nlp profanity check, title text limit at around 30), an optional description (this should probably not be fully displayed on the store title card and instead will be displayed when the user clicks on the book to find out more, also run a profanity check, below 200 chars sounds good), the publishing account (I want to use the e2e testing email for publishing my default public books, which happens to be the beta contact email as well, let me know if I should change this, i dont think i need to), whether the publishing account is verified (obv my testing and contact account is verified or not, we will also want to be able to verify users/highlighted-creators), the amount of ratings/downloads (rating is stars and is a float value with one decimal, out of 5), importantly - the number of positions (we may want to limit this number, I actually do not know how many positions books will end up having because I know chess can explode. We may want to search public opening books to see how many positions some openings have), and lets also have an optional difficulty field. These fields will be on the title card of the book store. More info may be in the screen that appears when book title cards are clicked on but not saved to library, like the full description, the book visualization (which i need to work on, hopefully relatively simple and will look similar to the current treemap) with a small demo board (as is shown in the labyrinth and treemap sidebar). Then we would also allow users to save the book/repetoire to their personal library (temp guests get a temp browser saved library, beta testers get a saved library).
  > ME: When we get to measuring individual user success rate on book positions, we will want to allow users to decide whether to add their success stats to the public book position success rates (default is to keep success rates private obviously). This will allow a leaderboard system in the future.
- D2. Books and repertoires can be exported and imported as files, without adding load to
  the back end. Export files carry a version number. A new account can upload earlier
  books, repertoires or libraries.
  > ME: Should we consider allowing users to import/export their session information if the browser doesnt save it? relying on saved browser info with warnings for when browser saved info may be lost could be the correct direction.

  > ME: 10/7, right now I am in favor of session import/export over book level import export. This will be easier for guests to use if they choose. Automaticky, guests will have their info saved in their browser but this method will need a fallback because many users cant/dont want to save data in their browsers. Caveat is that we might not want people to import some GM/IM chess players book success history as their own. So maybe that part cannot be transfered.
- D3. Shared book codes and publicly uploaded books may follow. They are not in this plan.
- D4. The library interface comes from `deployment.md` Phase 5. This plan builds on it and
  replaces the "coming soon" prompts that phase ships.
  *Amended 2026-10-07 (`deployment.md` D23):* Back up and Restore shipped with the Library
  instead, so no export or import prompt is left to replace.

From the user's answers on 2026-10-06.

- D5. A Bookstore book is copied into the library, not linked. The user can edit their copy
  like any book, and later changes to the default don't reach it.
- D6. When two books in a repertoire answer the same position differently, both moves stay.
  The trainer accepts either, and the book view marks the position so the user can see the
  clash. Since a repertoire is a book (D11), a clash is any position where the book's own
  side has more than one move.
  > ME: Multiple choices for a book should not be a problem for the way I am considering generating opening drills. I dont think we will need to prune book decisions, but this is an interesting thing to keep track of so that the user can make multiple correct moves in the trainer, as opposed to usual chess puzzles where a user can only make one correct move. In the future, I may even plan to allow users to submit multiple moves in one position to signify that they know there are multiple correct moves.
- D7. Default books are not built from the catalog. They are built from an outside source
  (Q1) as drafts on the publishing account (D13). The user approves the first ones before
  they go public, and an agent may publish later ones once the user is comfortable with
  that. The book display (Notes) will be a second way to build and edit them.
- D8. Store books carry no user statistics. A store card shows the title (at most 30
  characters), the publisher with a verified mark, the star rating with its count, the save
  count, the positions against the limit (D15), the difficulty (D9), the book–repertoire
  scale beside the depth (D11) and an "unconnected lines" flag (D16). Users give 1 to 5
  stars, and the card shows the average to one decimal. Opening a card shows the full
  description (at most 200 characters), the book display with a small board, and Save to
  library, which saves into the browser for a guest and into the account for a beta tester.

  *Amended 2026-10-07 (the user's note on `deployment.md` D21):* the verified mark sits
  outside the publisher's name and its highlight, so no name can imitate it, and a publisher
  who isn't verified gets a plain "Unverified" label in the same place, worded neutrally. The
  user verifies accounts one at a time (D13).
- D9. Difficulty is computed from the number of positions and the average depth of the
  leaves, each leaf counted at its shortest move order. It is shown beside an optional
  difficulty the publisher sets, since some openings are hard in ways a formula can't see.
- D10. A user's own success rates stay private unless they choose to add them to a book's
  public per-position rates, which would later allow a leaderboard. Both belong to a trainer
  plan, not this one.
- D11. **A repertoire is a book.** There is one kind of object, so one table, one card, one
  export format and one path through the trainer. Combine makes a new book from the merge
  of others, as a copy (like D5), and keeps its sources' ids so a "Rebuild from sources"
  button can come later. The **book–repertoire scale** is coverage: follow master games
  from the root; wherever the other side moves, the games whose move the book has stay in
  and the rest leave; the scale is the share that reaches a leaf. A shallow book catches
  nearly everything (a book of only 1.e4 scores 100%), so the scale is always shown beside
  the depth (D9), which together give users a real estimate of what to expect. A store
  book's scale is worked out when it is published and saved with it; a library book's is
  worked out in the browser from saved positions, which for a guest means cached ones only.
- D12. **The library backup is the main export.** "Back up library" writes one file with
  everything (books now, drill statistics and game history later), and "Restore" reads it
  back, merging by book id. Exporting a single book stays as a smaller action, for sharing.
  The browser stays a guest's main store (deployment D12): the app asks it to keep the data
  (`navigator.storage.persist()`), and when the browser won't promise that, or the library
  changed since the last backup, the Library shows when it was last backed up and why that
  matters. Files carry a SHA-256 checksum, described as damage detection only. There is no
  signature: anyone can recompute a checksum made in the browser, a server-held key would
  add back-end work and protect nothing, because import checks every field and replays
  every move (Notes), and a changed file can only affect the person importing it. Public
  numbers (D10) are checked on the server whatever a file carries.
- D13. **The publishing account is "ByTheBook"**, made by the user for this, with its
  details in `.env.local` as `PUBLISHER_EMAIL` and `PUBLISHER_PASSWORD`, which scripts load
  and agents never read. Drafts (D7) wait there unpublished. It is the only verified
  publisher and the app's official account. The verified mark is keyed on the account's id,
  not its username, and only the service role can set it, which the user
  does in the SQL editor for people they verify personally. A beta tester is not a verified
  publisher. The browser-test account stays a test account.
- D14. **Guests can browse the Bookstore** and try its books: open one, see its tree and
  board, and save it into the browser library. They can't publish, upload or rate. Two `GET`
  routes serve the store, one for its cards and one for a single book's tree, as the second
  exception to the 401 rule. Each reads with a cap (at most 200 public books), and the CDN
  keeps each answer for a few minutes (`data-delivery.md` D3), so a crowd of guests costs one
  function call per address every few minutes. Saves are counted for accounts only, since a
  counter guests could call would let anyone inflate it. Guest access to the Labyrinth's
  cached positions is `region-map.md`'s work (D8 and Q1 there), in a later run.
- D15. **A book holds at most 1,000 positions** (`MAX_BOOK_POSITIONS`), and a verified
  publisher's up to 5,000. Users see the count against the limit ("198 / 1,000"). The limit
  is checked on save, import and Combine. For scale: every named opening together comes to
  7,864 positions, Vercel's 4.5 MB request limit stops a book near 15,000, and the
  Queen's Gambit section of Wikibooks has 198 (Q1).
- D16. **A book holds a list of trees,** each starting from a position. An ordinary book is
  one tree from the starting position. A book with more than one tree, or whose tree starts
  elsewhere, gets the "unconnected lines" flag; a gambits book is the usual case, since a
  gambit can come up from many move orders. Each tree stays a true tree keyed by move
  sequence (`AGENTS.md`). The trainer sets up each tree's first position, and the Explorer
  and the maps match a later tree by its first position. The export format carries the list
  from version 1. It landed with the library work in `deployment.md` Phase 5, which moved
  every book into `opening_books.trees` on 2026-10-07.
- D17. **Difficulty is a number from 0.0 to 5.0, to one decimal, color coded, and the
  publisher's comes first** (Q5, the user's word, 2026-10-21: "Publisher difficulty should be
  priority, color code the difficulty scale and allow it to be up to one decimal point").
  - A book with a publisher's difficulty shows it first, as "Publisher 4.0", with the measured
    one beside it, smaller ("measured 4.3"). Any other book shows only the measured one.
  - The measured difficulty comes from what the user must remember: *m* = the book's own moves
    (one per answer) × the average line in plies ÷ 10, since a long line is harder to recall in
    order. Difficulty = log₂(*m* ÷ 12.5), kept between 0 and 5 and rounded to one decimal, so
    each point doubles the load. On the example books: the English 0.9, the King's Gambit 1.0,
    the French 2.3, the Queen's Gambit 2.9, the Sicilian 3.1, the Queen's Gambit masters 3.4,
    the Caro-Kann and the Ruy Lopez 3.5, the Italian 4.3, and the 1,000-position catalog book
    5.0.
  - The color comes from five theme tokens, one per whole point, from green (0 to 1) through
    gold in the middle to deep red (4 to 5). They are tokens so vibes can repaint them, and the
    number is always written beside the color.
  - The trainer can recalibrate the scale later from how users actually do.
  - On a book's own page the two are dots on one scale, the publisher's larger, each with its
    number (the user's word after the third mockup round, `game-history.md` D36).
- D18. **A book's page has a "Leaderboard" link next to its reviews link** (the user's word,
  2026-10-21). Later, users will choose whether to make their success with a book public
  (probably only their drill stats), and see other users' public stats for that book, which is
  where the link goes; until then it is marked as coming. This extends D10, and like D10 it
  belongs to a trainer plan.

## Open questions

### Q1. Which outside source do default books come from?

Was "Where do the default books come from?". D7 holds what is settled.

> ME: No, i dont think I like this. Lets look online to see if there are any resources that list the positions in a given opening. The default book publishing workflow, assuming we collect what we need from a good resource, will be to collect these opening book positions, turn them into books with the testing account (bythebookbeta), and depending on whether I feel comfortable with it - having an agent publish them. The first few books will just be created on the testing account for my approval. Another powerful workflow for creating meaningful books (and actually for displaying meaningful information in other parts of the project) is to use the (future, similar to the treemap) book display tree to view or edit book positions.
> ME: Note that a book like a "gambits" book may contain lines that arent necessarily connected to each other or the root, reason being the book may be for fun or it is to train users on gambit lines that pop up sporadically in real games. We will flag books like this on the title card for not being connected

**Found (2026-10-06):**

- **Lichess master statistics,** which `position_cache` already holds for every named
  opening and the popular positions past them. Move counts are facts, so a book grown from
  them raises no licence question.
- **The catalog** (`lichess-org/chess-openings`, public domain) names lines but stops where
  the names stop.
- **Wikibooks' Chess Opening Theory** is a hand-written tree with one page per move
  sequence, under CC BY-SA.
- **Lichess studies** hold the richest hand-made repertoires, but their authors keep the
  rights (Lichess's terms of service), so a study can be used only with its author's
  permission.
- **Commercial books and courses** (Chessable, ChessBase) are off limits.

**Wikibooks, tried on the Queen's Gambit** (the user asked for its downsides and an example).
Its page titles are the tree, so one API call and a chess.js replay turn the 210 pages under
1.d4 d5 2.c4 into a book: 198 positions, 62 lines, an average line of 10 plies, the longest
23. The concept mockups draw this book. Apart from attribution:

- **Share-alike.** A book built from it is CC BY-SA, and so is anything made from that book,
  including a user's edited copy when they share it. That is fine for free books, but it
  can't be mixed into anything with stricter terms later.
- **Depth follows the volunteers, not the games.** The Slav has 113 of the 198 positions and
  the Queen's Gambit Declined 60, while the Queen's Gambit Accepted, a main line, has 12, the
  Chigorin 3 and the Albin Countergambit 1.
- **It is an encyclopedia, not a repertoire.** It lists both sides' alternatives: White has
  more than one move at 13 of its positions, so a White book needs one picked at each, by
  hand or by master statistics, or it is full of clashes (D6).
- **It is small and unchecked.** The whole section is a fifth of the 1,000 limit, its moves
  aren't checked by an engine, and one of the 210 titles is malformed.

**Recommendation:** grow each book from master statistics with a local script that reads
`position_cache` and makes no Lichess calls. The book's own side plays its chosen move (or
the most played one), the other side gets every reply above a share of games, down to a
depth. Each book's root, side and thresholds are written down, so a rebuild gives the same
tree. Lines a statistics walk misses, such as a gambits book's rare lines, are entered as
PGN, from Wikibooks with attribution or written by hand. Either way the script saves a
draft to the publishing account (D13) for approval.

> ME: I dont think this will work as well as you think it would. make a mock up book of this method for queens gambit so that i can compare it with another method of generating it.

**Compared (2026-10-06).** `npm run books:examples` built the Queen's Gambit four ways, and
each is an example book on the small visualization pages (pick it in the Book menu):

| Book | Positions | Lines | Average line | Clashes (as White) | Black's 2nd moves covered |
|---|---|---|---|---|---|
| Wikibooks | 198 | 62 | 10.4 plies | 13 | 8; the Slav has 113 positions, the QGA 12 |
| Catalog lines | 872 | 194 | 13.0 plies | 61 | 9; QGD 390, Slav 284, QGA 116, then the sidelines |
| Master statistics | 214 | 53 | 14.0 plies | 0 | 3 (2...e6, c6, dxc4); everything under 8% is gone |
| Catalog + masters | 1,000 (full) | 260 | 12.2 plies | 61 | 9, each line carried on from master games |

- **Master statistics alone is what the note expected:** a narrow repertoire. White plays
  one move everywhere, so there are no clashes, but the Chigorin, the Albin and the Baltic
  fall under the threshold, and lines stop wherever the cache does (44 positions had no
  numbers). It suits "a White repertoire against the main lines", not "the Queen's Gambit".
- **The catalog groups positions for us, with nothing to credit.** Its lines are named by
  opening ("Queen's Gambit Declined: Tarrasch Defense"), so every line through a position is
  that opening's book, and `lichess-org/chess-openings` is public domain. It is the largest
  and most even of the four. Like Wikibooks it lists both sides' alternatives, so a
  repertoire book needs one White move picked at each clash, which master statistics can do.
- **Wikibooks** stays possible, credited under CC BY-SA, for openings the catalog covers
  thinly; the eight Wikibooks examples show what it has.

**Recommendation (revised):** build each default book from the catalog's lines through its
root position, so the grouping and names come free and nothing needs crediting; for a
repertoire book, keep the most played White (or Black) move at each clash; and carry short
lines on a few plies from master statistics where wanted. Wikibooks fills gaps, credited.
> ME: Yes, all sounds great. But if we are generating books from catalog, may wnt to take a top p sample in clashes, which will typically result in one move, but could allow a few more to satisfy a slightly more general crowd of users.

The Bookstore is drawn in `docs/design/mockups/bookstore.html` (2026-10-07): cards to browse, a page
per book, and the example books as ByTheBook's store books. Drawing it raised Q2–Q4.

### Q2. What limit does a saved copy of a verified publisher's book have?

A verified publisher's book can hold 5,000 positions and a user's book 1,000 (D15), so a
saved copy of a large store book could already be past what a user may keep.

**Recommendation:** the copy keeps the limit it was published under, shown the same way
("1,000 / 5,000"). Editing can't take it past that limit. Combine makes a new book of the
user's own, so the result is held to the user's 1,000.

### Q3. Should display names that imitate the verified mark be refused?

The mark sits outside the name's highlight (D8, as amended), so "ByTheBook ✓" already reads
as a different publisher from ByTheBook, and its label says Unverified. The mockup draws such
a card.

**Recommendation:** yes. Refuse check-like symbols (✓ ✔ ☑) and the word "verified" in
display names, checked at sign-up and rename together with the profanity check (Notes), once
other people can publish (D3).

### Q4. Can a guest try a store book in the Explorer or the trainer without saving it?

**Recommendation:** no. Saving is one press and costs nothing, since a guest's copy stays in
the browser (D14). The Explorer and the trainer then always open books from one place, the
library. A store book's page offers "Open position in Explorer" for a single position.

### Book statistics (raised 2026-10-21)

The user wants every book statistic settled before the book pages change for game history
(`game-history.md` Q20). Already computed and kept in each book's summary
(`src/lib/library/types.ts`): positions (against the limit, D15), lines, the average line, the
longest line, clashes (D6) and the unconnected flag (D16). Coverage, the book–repertoire scale
(D11), is computed in `src/lib/books/measures.ts` but shown nowhere yet. Not built: difficulty
(D9), the publisher's difficulty, ratings (D8), reviews, descriptions, and how a library copy
shows any of the store's numbers.

Q5 (how difficulty is worked out and shown) is settled by D17.

### Q6. What does a saved copy show of its store book?

**Recommendation:** the copy keeps its store book's id (it stays a copy, D5). Its own page
shows the store book's current rating and save count, a link to its reviews in the Bookstore,
and the publisher with their mark, read from the store's cached routes (D14), so guests see
them too. The description and the publisher's difficulty are copied with the book; if the
user edits the moves, the page says "Edited from" the store book, and the publisher's
difficulty is dropped, since it no longer describes the book. A signed-in user can rate the
store book from their copy's page.

> ME:

### Q7. Do books get written reviews, as well as stars?

**Recommendation:** yes, as an optional text with a rating: one per account and book, at most
500 characters, editable and deletable by its writer, checked with the word list (Notes), and
hidden by the user from the SQL editor if needed. The store book's page lists them newest
first, a capped page at a time. Guests read them and can't write them. Reviews belong to the
store book, not to copies, so editing a copy doesn't carry them.

> ME:

### Q8. Does every book get a description, and which screen shows which statistics?

**Recommendation:** every book may have a description (at most 200 characters, D8), the
user's own books too, so the field is the same everywhere. Then:

| Where | Shows |
|---|---|
| Library, first level (the picked book) | positions / limit, difficulty, lines, the longest line, clashes; the rating for a store copy |
| A book's own page (Library) | everything: the description, difficulty and the publisher's, positions / limit, lines, the average and longest line, clashes, coverage, unconnected; for a store copy also the rating, saves, publisher and the link to reviews |
| Bookstore card (D8) | as D8: title, publisher, rating, saves, positions / limit, difficulty, coverage beside the depth, unconnected |
| A store book's page | as a book's own page, with the reviews below |

> ME:

### Q9. How is a store book's page laid out?

The user wasn't sure about a store book's page reading almost the same as its Library copy's
(`game-history.md` D40), and asked for layouts that put the book and its publisher before the
reader's own numbers, with reviews and the leaderboard on the left in at least one
(2026-10-24). `plans/mockups/bookstore-spread.html` draws them on a whole spread. Each keeps the
board and the drawing on the right page:

- **A, the book first:** a title page with what the book covers, a subtitle, the rating and
  Save to library; a short blurb; the chapters, each opening the book names; and the
  publisher, with a line about them and three more of their books. Publishers would need a
  short bio, which this plan doesn't have yet.
- **B, readers:** a short title block and the facts, then the reviews and the leaderboard
  (D18), each scrolling in its own box. The leaderboard ranks players who chose to show their
  drill stats (D10) by lines known, accuracy and drills, this month or all time.
- **C, played by masters:** a list of masters, each with how many of their moves as White,
  while still in the book's lines, the book has, and how far they stay in it. Picking one
  paints the drawing with their games.
  - The user wants this section later ("it would be cool to see if a book is similar to what
    someone like spassky or capablanca or hikaru played/plays").
  - It needs games tagged by player, which `position_cache` doesn't have; Lichess's masters
    explorer can't filter by player. A script would read collections of master games once,
    like the example books, after their licences are checked. It would get a plan of its own.
- **Like the Library:** the earlier layout, for comparison.

**Rec:** A, with C's masters section added below the chapters once its data exists. A is the
one that sells the book, and a reader who wants the reviews reaches them from the rating, as
today. B fits better once the leaderboard has real players in it.

> ME:

## Steps

Drafted 2026-10-06; the user asked for them to be carried out the same day ("Implement the
plan"). Phase 3's script waits on Q1; the rest doesn't.

### Phase 1. Book measures

- [x] (agent) `src/lib/books/measures.ts`, pure and tested: positions against the limit
      (D15), the "unconnected lines" flag (D16), leaf depths at the shortest move order (D9),
      clashes (D6), and coverage from master numbers (D11).

### Done: Phase 2. Library (`deployment.md` Phase 5)

Done 2026-10-07: books as lists of trees (D16), the version 1 backup file (D12), and the
limit (D15) checked on save, restore and the copy at sign-in, all in `src/lib/library/`
(`docs/architecture.md` § "Storage and database").

### Phase 3. Publishing

- [ ] (agent) Migration: who is verified (D13); the store fields on books (description,
      publisher's difficulty, published date, scale, rating sum and count, save count);
      ratings, one row per user and book, changed through one database function.
- [ ] (user) Run it, mark the publishing account verified by its email, then
      `npm run db:types`.
- [ ] (agent) The publishing script (waits on Q1): builds a draft on the publishing account
      from its source and rules, and publishes it when the user says so.
- [ ] (user) Approve the first drafts.

### Phase 4. Bookstore page

- [x] (agent) The pages, on the example books (the user's choice, 2026-10-07): the cards
      (D8) without ratings or saves, the detail view with a board and the book views, and
      Save to library. Done in `deployment.md` Phase 5b (`docs/design/dashboard.md`
      § "Bookstore").
- [ ] (agent) The store's back end under the pages: the two cached guest routes (D14) in
      place of the static files, ratings and saves on the cards, sorting by saves, and
      rating for accounts. Waits on Phase 3.
- [ ] (user) Check-in, as a guest and signed in.

### Phase 5. Combine, backup and restore

- [ ] (agent) Combine (D11) with clash marks (D6) and the limit (D15).
- [x] (agent) Back up and Restore, `persist()` and the backup notice (D12). Done in
      `deployment.md` Phase 5 (its D23), and the user restored one browser's backup in
      another on 2026-10-07.
- [ ] (agent) Single-book export and import.

## Notes

- Export and import run entirely in the browser. Import validates the file and replays
  every move with chess.js instead of trusting the file's positions, with a cap on file size
  and positions. A bad file can only affect the person importing it, and the server
  validates again when local books are copied into an account.
- Safari deletes a site's saved data after 7 days without a visit, which is why export and
  import matter to guests.
- `buildMoveTreeFromLines` and `mergeMoveLineIntoTree` (`src/lib/chess/moveTree.ts`) already
  merge lines into a tree keyed by move sequence, which is what Combine (D11) and PGN entry
  (Q1) need.
- The trainer is still a placeholder, so "drilled the same way" means here that a repertoire
  has the same shape as a book. Drilling itself belongs to a trainer plan.
- **Profanity checks** (from the first note on D1) matter once other users publish (D3). The
  30- and 200-character limits go into the Zod schemas now. A word-list check, such as the
  `obscenity` package, which runs in Node and the browser, comes with public uploads. A
  language model would be more than this needs.
- **Ratings stay within `deployment.md` D1.** A rating is one row per user and book, and the
  book's row keeps a running sum and count, updated in the same call, so no card ever
  averages ratings on request.
- **Usernames are unique, ignoring case** (since 2026-10-07: letters, digits, `_` and `-`,
  `USERNAME_PATTERN` in `src/lib/validators/schemas.ts`), so no one else can be named
  "ByTheBook" (the publishing account's name since 2026-10-07), and no name can hold a mark.
  The browser tests' account is "testaccount".
- **The book display** (the user's direction, 2026-10-06) is a finished, better version of
  the Explorer's mini tree, close to the Treemap, sharing the screen with a board. Five
  concept mockups were drawn and ranked on 2026-10-06, and all five are now built as the
  book views (`docs/design/explorer.md`): the Explorer's tree window and the small
  visualization pages show them, with example books. Viewing a book is done; editing a
  book's positions from them is still to come, and the store's detail view will use them.
