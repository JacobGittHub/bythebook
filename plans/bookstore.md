# Bookstore, repertoires and library files

Status: deciding · Updated: 2026-10-26 · Depends on: deployment.md

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
  belongs to a trainer plan. D22 says where the two links lead.
- D19. **Every book holds at most 1,000 positions, a publisher's too** (Q2, the user's answer of
  2026-10-25: "1000 positions should be enough for most books, publisher or not"). It amends
  D15, whose 5,000 for a verified publisher goes, so a saved copy of a store book is held to
  the same limit as any book. "In the future I may increase this limit for books by specific
  accounts", so the limit stays a lookup by account (`positionLimit`), returning 1,000 for
  everyone until then.
- D20. **A guest tries a store book by saving it** (Q4, "Agreed"). Saving is one press and
  costs nothing, since a guest's copy stays in the browser (D14), and the Explorer and the
  trainer open books only from the library. A store book's page offers "Open position in
  Explorer" for a single position.
- D21. **A saved copy keeps its store book's id and shows the lines its owner customized**
  (Q6, the user's answer of 2026-10-25). How the copy's page marks the moves added or removed
  since saving is worked out with the store's back end (Phase 4). The rest of Q6's
  recommendation, which the answer didn't question, goes with it: the copy's page shows the
  store book's current rating and save count and the publisher with their mark, read from the
  store's cached routes (D14); the description and the publisher's difficulty are copied with
  the book; once the moves are edited the page says "Edited from" the store book and drops the
  publisher's difficulty; a signed-in user can rate the store book from their copy's page.
- D22. **Books get written reviews, and a Library copy shows them on a third level** (Q7, the
  user's answer of 2026-10-25).
  - A review is an optional text with a rating, at most 200 characters, one per account and
    book, editable and deletable by its writer, checked as D25 says, and hidden by the user
    from the SQL editor if needed. Only signed-in users write them; guests read them. Reviews
    belong to the store book, not to copies, so editing a copy doesn't carry them.
  - A store book's page lists them (D24), newest first, a capped page at a time.
  - A Library copy's reviews and leaderboard links don't go to the Bookstore. They open a third
    level of the Library: one whole spread holding both the reviews and the leaderboard ("a
    single openfold view of both, kind of like a third level to the library"). The Bookstore
    has no third level. The page ears that move between the levels are `book-ui.md` D21.

  *Amended 2026-10-25 (the user's note on the mockup: "I don't think people should be able to
  review a book from the bookstore page"):* a store book's page only lists reviews. A review,
  with its rating, is written from a saved copy, on the Library's third level, so only someone
  who has the book in their library can review it.
- D23. **Every book may have a description, and each screen shows these statistics** (Q8, the
  user's answer of 2026-10-25). The description is at most 200 characters (D8), on the user's
  own books too, so the field is the same everywhere.

  | Where | Shows |
  |---|---|
  | Library, first level (the picked book) | positions / limit, difficulty, lines, the longest line, clashes, unconnected; the rating for a store copy |
  | A book's own page (Library) | everything: the description, difficulty and the publisher's, positions / limit, lines, the average and longest line, clashes, coverage, unconnected; for a store copy also the rating, saves, publisher and the links to its reviews and leaderboard (D22) |
  | Bookstore card (D8) | as D8: title, publisher, rating, saves, positions / limit, difficulty, coverage beside the depth, unconnected |
  | A store book's page | as D24 lays it out |

- D24. **A store book's page is `bookstore-spread.html`'s layout B, changed** (Q9, the user's
  answer of 2026-10-25: "I like B the most, although I get that there are no reviews or
  leaderboards yet").
  - The left page holds the title block and the facts, then "In this book" (the chapters, each
    opening the book names), then one section that switches between Reviews and Leaderboard,
    below "In this book" ("I want the 'in this book' section on top of the
    leaderboard/reviews section").
  - The right page keeps the board and the drawing.
  - Until there are reviews and a leaderboard, the section says so in place of them. It has no
    box for writing a review (D22, as amended).
  - "Played by masters" (layout C) is later work, with a plan of its own (`master-books.md`): it needs games tagged
    by player, which `position_cache` doesn't have.
- D25. **Names, titles, descriptions and reviews are checked by their shape and a word list**
  (Q10, the user's answer of 2026-10-25: "Start with 1 and 2 for now").
  - **Shape:** lengths and allowed characters in the Zod schemas, so the browser and the routes
    check alike: titles at most 30 characters (D8), descriptions and reviews at most 200 (D8,
    D22), usernames as `USERNAME_PATTERN` already has them.
  - **Word list:** the text is folded first (case, accents, look-alike letters, spellings like
    "sh1t", spaces or dots between letters), then matched against banned words, with allowed
    words so "Scunthorpe" or "assassin" pass. It runs in the browser for instant feedback and
    on the server for the check that counts, and sends the text nowhere.
  - Names are checked at sign-up and rename, titles and descriptions on save and publish,
    reviews on save. A text that fails is refused with a plain message, not cleaned.
  - A model and a report button, the third and fourth layers Q10 described, wait. Notes keep
    what was found about models for when they're needed.
- D26. **A username can't contain the word "verified"** (Q3, the user's answer of
  2026-10-25: "Yes"). `USERNAME_PATTERN` already keeps check marks out, so the word is what
  remains; it is refused at sign-up, and at rename when there is one. Done 2026-10-25
  (`claimsVerified`, `src/lib/validators/schemas.ts`).

## Open questions

### Q1. Which outside source do default books come from?
> ME: 10/26 I want to find good book recommendations that involve few clashes. This would be similar to something like chessable opening recommendations, where users are given few/one choice for their moves while blacks responses are still explored. This kind of opening would be much more relevant to practice. One way that I want to try and obtain these openings is by potentially searching the lichess masters db with a filter set to some master player, for example, say daniel naroditsky, with black pieces, against the english opening. Then we collect the relevant lines he plays, probably with clashes becasue real chess players like to have a diverse repetoire, and I prune the branches I want to prune. Then i would publish the book from the bythebook official account as an opening like "Naroditzky: black against the english"  or something like that.

**Player books, tried (2026-10-26)** after the 10/26 note. The masters database can't be
filtered by player, so `npm run books:players` grows books from players' public online games
instead (Chess.com months, a Lichess export), with `growBook`. The player's side keeps its
most played moves up to a share (top p), the other side every reply above a share. Each book
has a position budget, and the fewest games a move needs is the lowest that fits it, so lines
end where the games thin out. Ten drafts are in the publishing account's library. Each name
says whose games it was grown from, and each description says the player had no part in it.
The pipeline these lead to is `master-books.md`. Speed Chess Championship games aren't tagged in Chess.com's archives, so Hikaru's White book
uses his games against players rated 3000 or more.

| Draft | Games | Positions | Average line | Clashes | Player's games to a line's end | Master games covered |
|---|---|---|---|---|---|---|
| Hikaru vs 1.e4, tight (top p 0.5) | 6,078 | 297 | 10.7 | 10 | 12% | 5% |
| Hikaru vs 1.e4, mid (0.8) | 6,078 | 583 | 9.6 | 36 | 35% | 23% |
| Hikaru vs 1.e4, wide (0.95) | 6,078 | 931 | 9.4 | 57 | 45% | 26% |
| Hikaru White, tight (0.5) | 4,614 | 270 | 12.8 | 5 | 6% | 22% |
| Hikaru White, wide (0.9) | 4,614 | 966 | 8.5 | 74 | 40% | 50% |
| Rozman Caro-Kann (0.7) | 1,986 | 454 | 11.7 | 19 | 28% | 8% |
| Naroditsky KID, tight (0.5) | 7,422 | 295 | 15.3 | 0 | 15% | 5% |
| Naroditsky KID, wide (0.9) | 7,422 | 991 | 14.7 | 60 | 37% | 10% |
| Rosen gambits, White (0.85) | 502 | 414 | 11.0 | 22 | 44% | 38% |
| Rosen gambits, Black (0.85) | 933 | 477 | 13.8 | 19 | 38% | 11% |

- A wider top p catches more of the player's games but spends the budget on breadth, so lines
  shorten (Hikaru's White book: 12.8 plies at 0.5, 8.5 at 0.9).
- Master coverage stays low for a narrow repertoire: online blitz opponents and masters reply
  differently, and `position_cache` stops short of many deep positions.
- A game's opening is its deepest catalog name (`openingOf`), since "King's Indian Defense" is
  named at 3.Nc3, before Black's choice. A gambit is the first position named one, offered by
  the side whose move reached it (`gambitOf`).

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
per book, and the example books as ByTheBook's store books. Drawing it raised Q2–Q4. Q2 and
Q4 are settled by D19 and D20, Q10 by D25 and Q3 by D26.

### Book statistics (raised 2026-10-21)

The user wants every book statistic settled before the book pages change for game history
(`game-history.md` Q20). Already computed and kept in each book's summary
(`src/lib/library/types.ts`): positions (against the limit, D15), lines, the average line, the
longest line, clashes (D6) and the unconnected flag (D16). Coverage, the book–repertoire scale
(D11), is computed in `src/lib/books/measures.ts` but shown nowhere yet. Not built: difficulty
(D9), the publisher's difficulty, ratings (D8), reviews, descriptions, and how a library copy
shows any of the store's numbers.

Q5 is settled by D17, and Q6–Q9 by D21–D24. The "Played by masters" idea from Q9's mockup
(the user: "it would be cool to see if a book is similar to what someone like spassky or
capablanca or hikaru played/plays") needs games tagged by player; Lichess's masters explorer
can't filter by player, so a script would read collections of master games once, like the
example books, after their licences are checked.

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

- [x] (agent) Migration: who is verified (D13); the store fields on books (description,
      publisher's difficulty, published date, scale, rating sum and count, save count);
      ratings, one row per user and book, changed through one database function; reviews,
      one row per user and book, at most 200 characters (D22). `positionLimit` returns
      1,000 for everyone (D19), and `MAX_VERIFIED_BOOK_POSITIONS` goes.
      Written 2026-10-25 as `supabase/migrations/20261025120000_bookstore.sql`. A rating and its
      review are one row, since D22's review is "a text with a rating". Users may change every
      column of their own books and profile, so the verified mark, a store book's totals and
      the reviews are tables of their own (`verified_publishers`, `store_books`,
      `book_reviews`, `book_saves`) that only the service role writes, through
      `review_book`, `delete_review` and `count_book_save`. `review_book` refuses an account
      without a saved copy (D22, as amended). The description and the publisher's difficulty
      are columns on `opening_books`. The limit change is in the code.
- [x] (user) Run it, then `npm run db:types`. It marks the publishing account verified by its
      username, "ByTheBook", so no email is needed.
- [x] (agent) The text checks (D25): one module that folds a text and matches it against the
      word list, tested in Node, used by the Zod schemas for usernames, book titles,
      descriptions and reviews.
      Done 2026-10-25 for usernames (at sign-up; there is no rename yet) and book names, in
      the browser and on the server: `src/lib/validators/words.ts`, on `obscenity`, which
      refuses none of the catalog's 3,174 opening names. Descriptions and reviews use it once
      they have fields.
- [ ] (agent) The publishing script (waits on Q1): builds a draft on the publishing account
      from its source and rules, and publishes it when the user says so.
      Drafts can be written now (2026-10-26): `npm run books:players -- --save` saves player
      books there (`src/lib/db/publishing.ts`). Publishing waits on Q1 and the store's back end.
- [ ] (user) Approve the first drafts.

### Phase 4. Bookstore page

- [x] (agent) The pages, on the example books (the user's choice, 2026-10-07): the cards
      (D8) without ratings or saves, the detail view with a board and the book views, and
      Save to library. Done in `deployment.md` Phase 5b (`docs/design/dashboard.md`
      § "Bookstore").
- [ ] (agent) The store's back end under the pages: the two cached guest routes (D14) in
      place of the static files, ratings and saves on the cards, sorting by saves, and
      rating for accounts. Waits on Phase 3.
- [ ] (agent) A store book's page as D24 lays it out, on a whole spread like the Library's
      book page, with the Reviews and Leaderboard section saying so until it has rows. Then
      the Library's third level of reviews and leaderboard (D22), and the page ears
      (`book-ui.md` D21, D22).
      The store book's page is done (2026-10-25, `StoreBookPage.tsx`), on the example books, with
      its back ear; the Bookstore is a whole-spread chapter, so a visualization's page is now
      the browser tests' zoomed second level. The source's credit keeps title, author and
      licence on the page and its stated changes behind "How it was made", so the page fits a
      short laptop. Chapters named under another ("Queen's Gambit Declined: Albin
      Countergambit") show only the rest of their name. Still to do: the Library's third level
      with the reviews ear and the two-fold ear.
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
- **Profanity checks** (from the first note on D1) are D25: shape and a word list.
- **If a model is added later** (the third layer Q10 described, looked up 2026-10-25 at the
  user's request):
  - **Jev** (TypeSafe AI, released September 2026) answers a typed question about a text with
    probabilities instead of words: pick one of several options, score on a scale, or yes/no.
    Several Jev questions per field ("insulting?", "hateful?", "sexual?") would each give a
    probability to compare with a threshold. Reported price: $0.042 per million input tokens,
    output free, so a 200-character review with its questions costs a small fraction of a cent.
    Against it: it is hosted, so users' text goes to TypeSafe in the United States, which the
    privacy notice would have to say, and retention terms differ between sources; it is a
    month old; and a review found that text inside the input shifts its probabilities, which
    matters when the input is exactly what a troll writes. Checked only in secondary sources.
  - **A small model on our side:** `minuva/MiniLMv2-toxic-jigsaw-lite-onnx` on Hugging Face,
    23 MB quantized, Apache-2.0, distilled from `unitary/toxic-bert` (test ROC AUC 0.981
    against the teacher's 0.983), two labels (toxic, severe toxic), English only, 256 tokens
    at most, run with ONNX Runtime. `Xenova/toxic-bert` (about 111 MB) is the larger
    alternative that Transformers.js runs as is. Against both: they were trained on Wikipedia
    talk-page comments, so chess words need testing, and running one in a Vercel function
    strains `deployment.md` D1 (cold starts load the model); in the browser it gives instant
    feedback but can't be the check that counts.
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
