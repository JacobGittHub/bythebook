# Game history import

Status: active · Updated: 2026-10-25 · Depends on: deployment.md

**Goal:** let a user import their own games and see how they have done in their openings.
**Done when:** a user can import a PGN file of their games in the browser, see their games and
results on a game history page in the Library, and see their success from those games on a
book's own page.

## Decisions

- D1. Users can import their game history when it is in a suitable format and size, so the
  app's displays can show it.
- D2. The import must not burden the back end, and it works for guests (D14).
- D3. Later the library may hold game history alongside books, repertoires and drill
  statistics, so it can be exported and synced into an account.
- D4. The import lives on the Library page, which holds the user's own data. It gets no
  sidebar tab of its own (`deployment.md` D18). The Library shows a "coming soon" section
  for it until this plan is built.

From the user's answers of 2026-10-21.

- D5. **PGN files are the format.** Lichess and Chess.com both export PGN. FIDE offers no
  game downloads, so over-the-board games come as PGN from tournament files or ChessBase.
  ChessBase's own file formats are not read.
- D6. **A user's own games only, for now.** Fetching another player's games, such as a GM's,
  to see them on the visualizations, is later work. Storage is not what holds it back: with a
  move cutoff, a long history is a few megabytes (Notes).
- D7. **Chess960 and games from a set-up position are skipped,** and the import says how many.
- D8. **What a game keeps:** its source and game id, date and time, the exact time control
  (base and increment, so a user can view "Chess.com 2+1" on its own; the app also groups
  them as bullet, blitz, rapid, classical and daily), the user's color, the result, both
  ratings, the moves, and the time used for each move. Opponents' names are not kept. A link
  to the game is built from the source and id, never copied from a header.
- D9. **The game history page holds all of a user's games and statistics.** A book's own
  page shows its book three ways: plain, with success from the user's games, and with
  success from the trainer's drills. This makes `deployment.md` D21's success-rate direction
  an option on the book page.
- D10. **Comparing games with a book** records, for each game, where it left the book, who
  left it (the user, or an opponent's move the book doesn't cover) and the result. The book
  views can then show whether leaving at a given point did the user good or harm.
- D11. **The games kept per account is a named constant,** low to start and raised if storage
  grows. The import tells users what it keeps, for example the move cutoff (D16), so nobody
  takes it for a full archive.
- D12. **The Explorer gets a "your games" mode** in place of the master stats, after the
  history page and the book comparison.
- D13. **The file never leaves the browser.** It is parsed in a Web Worker, which checks the
  file's size before reading, reads it as a stream, caps games, tokens and plies, uses no
  regex over the whole file, is stopped if it runs too long, and takes no zip files. The
  server receives only records, and checks them with Zod (patterns, enums, bounds, games per
  request). It takes the user from the session, never the body, and enforces the caps itself.
  It answers a guest with 401, counts each call with `recordUsage`, keeps rows private under
  RLS, accepts a repeated upload without duplicating it, and can delete all of a user's
  history at once.

From the user's answers to Q1–Q11, 2026-10-21.

- D14. **Guests get an import kept in this browser** (IndexedDB), since it costs the server
  nothing and lets visitors try it before asking for a beta key. The import asks the browser
  to keep the data (`navigator.storage.persist()`, as the guest library does). Where the
  browser won't promise it, as Safari doesn't (it deletes a site's data after 7 days without
  a visit), the import dialog and the history page say the games may disappear and that
  keeping the PGN file lets them import it again. Nothing is copied into an account at
  sign-in for now.
- D15. **An account's history lives in Postgres on the current Supabase project,** in rows of
  up to 1,000 games each plus one summary row per user, with the time per move in its own
  column. Storage is looked at again when puzzles and drills add their own data.
- D16. **The first 40 plies of each game are kept** (`GAME_HISTORY_PLIES`). Even 40 seems a
  lot to the user, so the cutoff is revisited once the app has more books, to see whether it
  can be shorter.
- D17. **No comments from game files are kept,** apart from clocks as numbers (D8). Separately,
  the user wants comment storage for positions later: one ByTheBook comment per position in
  the database, outlining White's and Black's plans, with formatted "threat" arrows. A user
  who gets a position wrong in drills, or sees they lose games after it, could read it. Users'
  own notes per position may follow. Where the comments come from is open. That is its own
  plan, made when the user asks, not part of this one.
- D18. **An account keeps 10,000 games to start** (`DEFAULT_GAME_HISTORY_LIMIT`). The limit
  can be tuned later, and raised for one account the user trusts: a row in `account_limits`,
  which only the service role writes, so the user sets it in the SQL editor. The server
  enforces the limit itself. Past it, the user chooses what gives way (D28), and the import says
  how many were left out.
- D19. **A game is a plain JSON record with its moves as UCI text,** and the tree that groups
  games by shared moves is built in the browser and never stored. The user asked whether
  200 ms a game means 200 seconds to load 1,000 games. It doesn't: the 200 ms was the cost of
  writing moves as indexes in the list of legal moves, which this rules out. UCI text loads
  with no rules engine, since a game is matched to a book by comparing UCI strings, which
  takes milliseconds for 10,000 games. chess.js runs once, at import, to turn SAN into UCI.
- D20. **The server checks shape and bounds and doesn't replay moves.** A bad move only spoils
  its owner's own view. A user sees their win rates where their games leave the book, which
  is the point of a book. To see further, they add the line to the book and read the rates at
  its new leaves. Replay comes back if a user's numbers ever join public ones
  (`bookstore.md` D10).
- D21. **Our own tokenizer reads the PGN, and chess.js (BSD-2-Clause) replays the moves.** No
  GPL code, such as chessops, so the app's code never comes under GPL.
- D22. **The import asks which player is the user,** pre-filled with the name in the most games,
  and shows how many games the name matches while it is typed. When a changed name leaves
  many games out, the report at the end says so plainly.
- D23. **Each game gets a duplicate key:** its source and game id (Chess.com's `Link`,
  Lichess's `GameId`), or for a game without one, such as an over-the-board game, a hash of
  the date, both names, the result, the game's length and its first moves, taken before the
  names are dropped. A game whose key is already stored is skipped and counted. A game typed or
  pasted by hand gets the hash too; a made-up id would add nothing, since there is no page on a
  site to link to.
- D24. **The tests read small fixtures** cut from the user's Chess.com games and a Lichess
  export, plus hostile files built inside the tests. The repository is public, so opponents'
  names are replaced, and the Chess.com games can't be traced to the user's account: their
  name, the game ids, the dates and the ratings are replaced too (the user's word, 2026-10-21).

From the user's answers to Q12–Q14, 2026-10-21.

- D25. **A guest keeps as many games in the browser as an account does**
  (`DEFAULT_GAME_HISTORY_LIMIT`). 10,000 compact games are about 5 MB, well inside what
  browsers allow; the real cost is import time, which a stricter rule wouldn't save.
- D26. **An account keeps nothing in the browser beyond its server limit.** The browser holds
  a copy of the account's games, so pages load without downloading them again, and nothing
  more, since games kept on one device would show different numbers on another. Raising the
  database limit (D18) is the way to keep more, now and as the app scales.
- D27. **A game that transposes into its book stays in it.** When a game plays a move the book
  doesn't have in that order but reaches a position the book holds, it rejoins the book there
  and the step counts as "transposed", so 1.c4 Nf6 2.d4 against a 1.d4 Nf6 2.c4 book doesn't
  count as leaving at move one. A small, fast move player (step 6, tested against chess.js)
  finds the positions. It also lets books whose trees start elsewhere (`bookstore.md` D16) be
  compared, and draws the history page's tree quickly.

From the user's word after Phase 1, 2026-10-21.

- D28. **When an import holds more new games than there is room for, the user chooses:** stop,
  keeping the current games and importing only what fits, or keep importing and drop the games
  imported earliest (not those played earliest). The history is kept in the order its games
  were imported, each import's oldest played first, in chunks numbered upward, so either way an
  import writes only the chunks at the two ends, and a history at its limit no longer rewrites
  every chunk. The first pass counts the user's new games, so the choice is asked before any
  game is replayed.

From the user's picks of the step 9 mockups, 2026-10-21. The import mockup is "the right
direction"; the user expects one more round of adjustments before building.

- D29. **The import starts in a dialog and runs on the Library's left page.** Choosing a file,
  checking it and the limit choice (D28) are a dialog, as New book is. Once the import starts
  the dialog closes, and its progress sits at the bottom of the Library's left page, under the
  books, so the user can keep using the app while it runs, if a little slower. The report
  takes the same place when it finishes, if it fits there well. A user on another page when it
  finishes gets a small toast in the bottom right corner, with the way to the report. The
  import therefore belongs to the dashboard, not the Library page, so moving between pages
  doesn't stop it; only closing or reloading the tab does. Only the book list scrolls, and the
  import stays fixed under it (Q18, the user's pick: "I like the import staying put"). The toast
  has a close button, so the user can dismiss it.
- D30. **The history page puts the games on the left and the tree on the right.** It is mockup
  B (tree first) with the tree and the games swapped:
  - the left page holds Your games: the filters, with the choice of imports beside them; the
    totals bar for what is chosen; and the games through the current position, newest first.
    At the starting position that list is every game, which was mockup A's list;
  - the right page holds the board on top, with the position's results, the moves played next
    and "Open in Explorer" in its upper right, and the tree below it in ply columns (D31);
  - the tree is colored by success, the user's score from each position, under a "Your score"
    switch that starts on; off, it is painted as the book views are. (Amended 2026-10-21: a
    choice named "Book's own" read oddly to the user.)
  - the board's side keeps its size as the position changes: the moves played next sit in a
    box of fixed height that scrolls inside, so a position with many moves never reflows the
    page.
  - the side can be White, Black or both at once (the user's word after the third mockup
    round). With both, the tree holds every game from the starting position, and the score at a
    position is the user's, whichever side they played.
  
  How the filters are laid out is D38. *Framing (the user's pick, 2026-10-21):* the page is a
  second level shown as a whole spread, without `book-ui.md` D8's zoom, since a zoomed second
  level shows only a strip of its left page, too narrow for the games list. Choosing imports means each game records which import it came from, and the history keeps a
  list of its imports (when, which file, how many games); the step 8 store gains both before
  Phase 3's migration is written.
- D31. **Ply columns is the default view on second-level pages:** a book's own page in the
  Library, a book's page in the Bookstore, and the history page. The icicle stays the default
  where a book is previewed small: the Library's first level and the Bookstore's cards and
  first level. The user finds the icicle less useful on a full page than the ply columns, so
  success from games is shown on ply columns first (Q19), and the icicle's texture comes later.
  This amends the default in `deployment.md` D21 for second levels only.
- D32. **The book views can be walked with the arrow keys.** The selected position is the
  current one. Up and Down move a highlight among its moves (its children in the tree), and stop
  at the first and last rather than wrap or jump to another branch; Right moves to the
  highlighted move, and Left back to the parent. The highlight starts on the most played move.
  The view's camera follows: a drawing larger than its box pans to keep the current position
  and its moves in frame, and the user can drag it to look around. This holds for every view
  and every page that draws one.
  
  *Amended 2026-10-21, after the user walked the mockups:* the camera zooms as well as pans, and
  is more eager about both:
  - It frames the current position and all its moves. When they don't fit at the present zoom
    it zooms out, and when they would sit small in a large box it zooms in, within the zoom's
    range. It moves as soon as the highlighted move nears the edge, not once it has left.
  - Zoom is a continuous scale from 0.5 to 4 (half size to four times), with finer steps on
    − and + (0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4), the wheel with Ctrl, and pinch.
    Fit stays.
  - Below 1 the drawing is hard to read, so the current position and the highlighted move are
    marked at a fixed size on screen, whatever the zoom: a ring and a label that don't shrink
    with the drawing.
  - The camera's own moves, panning and zooming to frame a new position, are eased transitions
    of about a quarter of a second, not jumps (the user found the mockup's "too snappy and
    instant"). Dragging and the wheel follow the hand at once, and a browser set to reduce
    motion gets jumps.

From the user's answers to Q15, Q16 and Q18–Q20, and their second look at the mockups,
2026-10-21.

- D33. **Three choices when an import doesn't fit (Q15, amends D28):**
  - Import the newest played of the new games that fit, and stop. Newest played, since sites
    order their exports differently (Chess.com oldest first, Lichess newest first).
  - Import them all and remove the games imported earliest.
  - Import none of them. For a signed-in beta account, this choice also lets the user ask for
    more room ("beta account holders should be allowed to submit a petition for increased game
    storage"), which D37 settles. A guest's history lives in their browser, so there is no one
    to ask.
- D34. **The import also takes pasted PGN** (Q16), for a few over-the-board games. The text
  goes through the same worker as a file, as a file of its own, with the same caps.
- D35. **Ply columns show success as color and thickness** (Q19, option C, "for now"): the line
  into each position is colored by the user's score from it, red through grey to green, and is
  as thick as the number of games that went that way. Lines no game reached stay faint.
- D36. **A book's own page reads as front matter, then body** (Q20, option B). The book's facts
  (difficulty, rating, description and measures) sit to the right of the title. Below them, in
  one row above the drawing, are the choices (the view, Plain / Your games / Drills, and which
  games). The page scrolls down to the drawing, the board and "where you leave this book"
  together. From the user's second look:
  - The panel by the board keeps its size: "Next in the book" and "Left the book here" stay
    apart, as drawn, and each is a box of fixed height that scrolls inside. The panel doesn't
    reflow as the position changes.
  - "Where you leave this book" scrolls inside its own box.
  - The button for which games ("All 1,160 games as White") opens the checkboxes (D38), so it
    doesn't look like a dropdown: no arrow. Blitz, Rapid and Classical are separate checkboxes
    in it.
  - Difficulty is `bookstore.md` D17: the publisher's first, color coded, 0.0 to 5.0.
  
  *From the user's third look (2026-10-21):*
  - Fewer scrollbars. Only the boxes above scroll inside; the page itself fits its spread where
    the screen allows, and the drawing grows down into the space that was left empty below it.
  - "Open in Explorer" sits right above the board, in the line with the position's name, not in
    a row of its own, to save height.
  - The publisher's and the measured difficulty are two dots on one scale, the publisher's
    larger, with both numbers written.
  - A little more space between the rating and "positions to remember".
  - A "Leaderboard" link sits next to the reviews link (`bookstore.md` D18).

From the user's answers to Q21 and Q22, 2026-10-21.

- D37. **A beta account asks for more room with a row, one at a time (Q21).** Under the third
  choice (D33), a signed-in account asks for a number of games, up to
  `MAX_GAME_HISTORY_REQUEST` (50,000), with an optional reason of at most 200 characters. It
  saves a row in `game_limit_requests` through one route, which answers a guest with 401. An
  account has at most one pending request at a time ("one active request per account, 200
  chars max"), which the database enforces. The user reads the requests in the SQL editor, sets
  the account's `account_limits` row and marks the request granted or declined. Until then the
  dialog says "Asked for more room on 21 Oct"; after a decline, the account may ask again. A row
  rather than an email ties the request to the account and keeps them all in one place.
- D38. **Choosing games (Q22), as `game-history.html` draws it** ("Looks good right now, but I
  want the option to view all games", which the user later explained as "both black and white
  games at the same time": Both, D30, the default):
  - The side is a toggle beside the title: White, Black or Both (D30), Both first, since the
    page opens on all of the user's games. Every other choice is a set of checkboxes that all
    start ticked, each with its number of games.
  - Time is one list: Bullet, Blitz, Rapid, Classical and Daily, each with its exact time
    controls nested beneath it; a class is part-ticked when only some of them are.
  - Sources and imports are one list: Chess.com, Lichess and Other, each with its imports
    nested beneath.
  - Dates are a strip of games per month across the page, dragged to choose a span, with
    presets beside it (3 months, a year, all).
  - One row of buttons says what is chosen ("Blitz, Rapid · 2,140", "All sources", "Since Mar
    2025"), each opening its checkboxes in a popover, with no dropdown arrow. "All games" ends
    the row, in place of Reset: it ticks everything, both sides and every date, so every game is
    one click away.
  - The book page's "which games" uses the same panels in its dialog; its side is the book's.
- D39. **The history tree folds rarely played moves into an "Other" node (Q23).** The user asked
  for "some kind of top p and top k setup with an expandable 'other' option" so the page doesn't
  draw too many nodes. On the last year of games the page drew 254 positions from the user's
  3,264 games, against 5,436 for all of them, so this matters most when "All" is chosen.
  - At each position, moves are kept, most played first, until they hold 90% of its games or
    number 8, whichever comes first. The rest fold into one "Other · 5 moves, 23 games" node.
  - Picking it (a click, or Right with it highlighted) opens it, for that position only, and the
    whole tree is laid out again with the opened moves in it (answered in chat, 2026-10-24: "the
    tree would be a much more managable size at the beginning. If the tree left room for
    unexpanded nodes, the tree size would potentially be unwieldy"). The camera keeps the opened
    position where it was on screen while the rest eases aside.
  - Folding happens in `historyTree.ts`, pure and tested, from the tree and the set of opened
    nodes, so the layout stays a pure function of both and every view draws fewer nodes without
    knowing why.
  - Books are drawn whole: their authors chose every move in them ("I agree with books being
    drawn whole").


From the user's answer to Q24, 2026-10-24 ("As for the library book pages and the clashes
dialogue box, implement them, they looks great").

- D40. **A book's own page in the Library is `book-spread.html`'s layout A, on a whole spread**
  as D30 frames the history page: the camera doesn't zoom in on any of the Library's second
  levels. It amends `book-ui.md` D8 for them. The user had liked layout A ("I really like the
  look of the A style open fold library page") and asked for these changes, all drawn in the
  mockup:
  - The left page holds the front matter, then the facts:
    - the difficulty scale, whose numbers show on hover, not as text;
    - moves to remember and the average line beside it;
    - positions, lines and clashes on the row below.
  - Below the facts are Plain, Your games or Drills (soon), and the games filter, which picks
    3 months, 12 months or all time at its top. A list fills the rest of the page: the book's
    contents, or where the user's games leave the book.
  - The right page holds the board with the current position, then the drawing.
  - There is no Switch book. "Back to all books" returns to the Library, where another book is
    chosen ("we will just allow the users to go back to the library to switch to other books
    instead").
  - **Clashes is clickable** ("allowing users to further select the lines they want to train").
    It opens a dialog listing each clash with its board and its moves to tick, with lines,
    games and score:
    - A clash is resolved when one of its moves is ticked, and at least one always stays ticked.
    - A clash below an unticked move doesn't count, since drills never reach it.
    - Unticked moves stay in the book and its drawing, which dashes them, but drills skip them.
  - **The count is flagged** while any clash is unresolved ("this would allow users to
    understand that they may want to consider catering their opening").
  - How leaderboards compare players who tick different moves is left to the leaderboard's
    plan ("Ill figure that out when we get there").
- D41. **An unticked move carries `skip: true` on its `MoveNode`,** in the book's trees
  (`opening_books.trees`), so the choice is part of the user's copy of the book:
  - It needs no migration, and it travels with every save, backup, duplicate and copy at
    sign-in, since `validateTrees` keeps that one flag when it rebuilds the trees.
  - It goes when its move is removed. A move added later starts ticked, so a clash it makes is
    flagged again.
  - A flag on a move that isn't one of the book side's moves at a clash is ignored. So is a
    clash whose moves are all flagged, since one move always stays ticked.
- D42. **Games can be fetched by username and platform** (Q25, the user's answer of
  2026-10-25: "I agree, fetch games by username and platform"). It amends D5, which read only
  files.
  - The import dialog offers two ways first, side by side: fetch from Chess.com or Lichess by
    username, or choose a PGN file. Pasting PGN (D34) is the second way, below them (the
    user's message of 2026-10-25).
  - The fetch runs in the browser and streams into the same import worker as a file, so
    nothing passes through our server (D13 holds) and guests can use it (D14). It asks only
    for a public username: no password, token or sign-in, which is the easiest thing to trust.
  - The user asked whether Chess.com needs an API key, and wants to "make sure that one
    persons api calls don't drown out everyone elses". As far as the agent knows (to be
    checked against both sites' docs in step 22):
    - Neither site asks for a key to read public games.
    - Both limit requests by the address they come from. Every user's browser makes its own
      requests, so one person's import uses only their own share, not the app's. People
      behind one shared address, such as a school's network, share its limit.
    - Requests go one at a time, and an answer of 429 (too many requests) waits a minute
      before trying again.
    - Lichess sends 20 games a second to anonymous requests, so 3,000 games take about
      2.5 minutes. Chess.com's come a month at a time. Chess.com's monthly files send
      `Access-Control-Allow-Origin: *` (checked 2026-10-24). Lichess's export answered 404 to
      a request from the agent's machine, so it needs a check from a browser.
  - Settings gets a short tutorial on downloading games from each site by hand, linking only
    to the sites' own pages, for people who prefer a file (the user's message of 2026-10-25).
    The import dialog's file option links to it, saying in words that it goes to Settings.
  - Anyone's username fetches their games, so this touches D6. The player question (D22)
    limits what is kept, not what is fetched. Catching a wrong username is D43.
- D43. **The import dialog shows whose username it is before fetching** (Q26, the user's answer
  of 2026-10-25: "Sounds like a great idea").
  - It reads the player's public profile and shows it as a card, "Is this you?", with their
    picture, title, ratings, country, join date and how many games the account has. It fetches
    only after "Yes, fetch my games". A name with no account says so at once.
  - The player question (D22) then asks which side of each game is the user, as for a file.
  - Game history never feeds the leaderboard: "Game history statistics will not feed into the
    leaderboard, only drills from our site will." So fetching another player's games on
    purpose harms no one, and no account needs verifying; Lichess's sign-in (OAuth) is not
    needed.

## Open questions

Q15–Q26 are settled by D29, D33–D40, D42 and D43. No question is open.

## Steps

Drafted 2026-10-21. The code lives in a new `src/lib/history/`, kept free of browser APIs and
tested in Node. Each phase ends with the typecheck, `npm run test:agent`, lint and
`npm run docs:check`.

**Phase 1. Reading games (no UI)**

- [x] 1. Constants, types and the record schema (agent), in `src/lib/history/types.ts`. The
  record's schema sits there with its type, as the library's `bookOriginSchema` does in
  `src/lib/library/types.ts`; the routes' request schemas join `schemas.ts` in Phase 3. The time
  control parser and its classes are `timeControl.ts`, each site filed by its own rule
  (Chess.com has no classical).
- [x] 2. Fixtures (agent): 19 of the user's Chess.com games and 9 Lichess games in
  `src/lib/history/fixtures/`, with opponents' names replaced and the Chess.com games made
  untraceable to the user (D24).
- [x] 3. The streaming reader, `pgnGames.ts` (agent), on a tokenizer moved to
  `src/lib/chess/pgnTokens.ts`, which `readPgn` now shares. A comment never closed ends at the
  next line starting `[` and a letter, so the games after it are still read.
- [x] 4. Game to record, `record.ts` (agent). Skips are counted as Chess960 or set-up, unfinished
  (result `*`), no player with the name, no moves, and unreadable. A game with an illegal move
  in its kept plies is unreadable, not cut short, so it is never taken to have ended there.
  Lichess's first move for each side counts as no time, since its clocks start after it.
- [x] 5. Merging, `merge.ts` (agent). Reworked for D28: games in import order, chunks numbered
  upward, and only the chunks at either end written, under or at the limit. `makeRoom` gives the
  dialog the numbers for each choice.
- [x] 6. The move player, `src/lib/chess/applyUci.ts` (agent, D27), writing en passant only when a
  capture is legal, as chess.js does. It matches chess.js on every fixture position and on
  random games, at about 3 µs a move.

Measured on the user's 3,322 Chess.com games (7.9 MB): reading takes 0.3 s, records about
2.8 ms a game (about 28 s for 10,000), and a record with its clocks is about 560 bytes as JSON.

**Phase 2. Importing in the browser, guests first**

- [x] 7. The import worker, `src/lib/history/import.worker.ts` (agent), a thin shell over the two
  passes in `importFile.ts`, which take a stream so they are tested in Node; the page's side,
  `importSession.ts`, starts it, cancels it and stops it past `IMPORT_TIME_LIMIT_MS` per pass.
  It refuses empty, oversized and compressed files before reading, and decodes `file.stream()`
  with a streaming `TextDecoder`. The first pass reads moves as well as headers, to hash the
  keys of games without an id (D23), so it can count each name's new games and the limit
  choice (D28) comes before the second pass, which replays only the games chosen. The worker
  first runs in a browser with step 10's dialog.
- [x] 8. The history store (agent): `GameHistoryStore` (`types.ts`) and its browser version,
  `browserHistory.ts`, an IndexedDB database `bythebook-history` with a `chunks` and a `meta`
  store. Writes check the version they were planned from and follow `writes.ts`, which the
  Phase 3 routes share: records that pass their schema, at most the limit of games, at most
  `chunkCap` chunks. `saveImport` merges an import and writes it. `useGameHistory()`
  (`src/hooks/`) gives a guest the browser's store and, until Phase 3, a signed-in viewer none.
- [x] 9. Mockups (agent, then user): the import dialog, the history page and the book page's
  success view, saved in `plans/mockups/` with the app's tokens and controls. The user picks
  before any of them is built. Made 2026-10-21 as `game-import.html`, `game-history.html` and
  `book-success.html`; the first picks are D29–D32, the second D33–D36, the third D37–D38 and
  the amendments to D30, D32 and D36 ("mockups look great"). The mockups don't draw the third
  round's small changes (Both, the eased camera, the book page's tighter layout); the
  decisions' text does, and the steps that build those pages follow it.
- [x] 10. The import (agent, D29), which replaces the Library's "coming soon" line
  (`src/components/library/LibraryPage.tsx`). The dialog: a file picker or pasted PGN (D34), the
  first pass's summary, the username with its live match count, what is kept (40 plies, the
  limit, no opponents' names), the notice for browsers that may delete data (D14), and the three
  choices when the new games don't fit (D33; asking for more room is D37, in Phase 3).
  Then, fixed at the bottom of the Library's left page under the scrolling book list (Q18):
  progress with Cancel, and the report: imported, duplicates, skipped by reason, the name
  mismatch prominent when large (D22), left out and removed. The import session lives in a
  provider in the dashboard's layout, so it keeps running across pages, and a `sonner` toast
  with a close button reports it done when the Library isn't open. Each stored game records its import, and the
  history keeps the list of imports (D30), in `types.ts`, `merge.ts` and `writes.ts`. Game
  history gets a row in `ACCESS_ROWS` (`src/lib/auth/access.ts`). A browser test then checks
  the worker loads under Turbopack. Done 2026-10-21: `GameImportProvider`
  (`src/context/GameImport.tsx`), `GameImportDialog` and `GameHistorySection`
  (`src/components/library/`). An import's id is the history's version after it, since the
  version only grows. `e2e/gameImport.spec.ts` imports a fixture, and a 5,000-game file while
  moving to the Explorer, where the toast closes with its ×.

**Phase 3. An account's storage**

- [x] 11. The migration (agent writes, user runs, agent runs `npm run db:types`),
  `supabase/migrations/<ts>_game_history.sql`:
  - `game_history`, one row per user: the game count, the chunks (each one's number, games and
    the version that last wrote it), the imports, the username, the last import's time, and a
    version for writes that check what they replace;
  - `game_history_chunks`, keyed by user and chunk number: `games` (the records with their
    import) and `clocks` as JSONB, the game count and the version that wrote it;
  - `game_history_staged`: the chunks of a write still being sent, the same shape plus the
    version they were planned from and the imports their games name;
  - `account_limits`, the games allowed per user (D18), and `game_limit_requests` (D37), with
    one pending request per user enforced by a unique index.
  
  Owners can read their own rows, and no one can write the tables through the API. Writes go
  through three functions, `stage_game_history_chunk`, `commit_game_history` and
  `clear_game_history`, which only the service role may run; the routes call them after taking
  the user from the session. Each locks the user's summary row, and the commit checks the version,
  the total against the limit, and that every chunk it names was staged from that version. So the
  server's caps can't be skipped by writing to the tables directly (D13, D18), as the books'
  "own books" rule would allow. Rows go when the account does.
- [x] 12. Database access and routes (agent), `src/lib/db/gameHistory.ts`, under `/api/history`:
  - `GET /api/history`: the summary, the limit (the `account_limits` row or the default) and the
    latest request for room;
  - `GET /api/history/chunks/[n]`: one chunk, with its clocks;
  - `PUT /api/history/chunks/[n]`: stages one chunk of a write planned from a version, refused
    when the version has moved on or more than `chunkCap` chunks are staged;
  - `POST /api/history`: commits a write, naming the chunks written and deleted, the username
    and the imports. `writes.ts` checks it against the stored and staged chunks' sizes and the
    imports their games name, so the route reads no games;
  - `DELETE /api/history`: everything;
  - `POST /api/history/requests`: asks for more room (D37).
  
  A write is staged because an import can change up to 11 chunks, about 6 MB, past Vercel's
  4.5 MB per request. The chunks go one per request and appear together at the commit; an
  import abandoned midway leaves only staged rows, which the next write replaces. Chunk numbers
  grow with each import (D28), so the server caps the games and the number of chunks, not the
  chunk number. Each route validates with Zod, answers a guest with 401, takes the user from the
  session and counts its call with `recordUsage` (new kinds `history_read` and `history_write`).
- [x] 13. The account store (agent), `src/lib/history/accountHistory.ts`, with an IndexedDB copy of
  the chunks: the summary lists the version that wrote each chunk, so opening a page reads the
  summary and fetches only the chunks that changed, and a monthly import refetches one. The copy
  belongs to one account and is deleted when a guest or another account opens the dashboard,
  as after signing out. `useGameHistory()` gives a signed-in viewer this store. The import
  dialog's third choice gets the request form (D37), and the Library's history section a "Delete
  all games" behind an AlertDialog, for both stores. The `ACCESS_ROWS` row says the account
  keeps them.

Done 2026-10-21: the migration `20261021120000_game_history.sql` (run by the user),
`src/lib/db/gameHistory.ts`, the routes under `src/app/api/history/`, `accountHistory.ts` and the UI.
`e2e/gameImport.spec.ts` imports into the test account, keeps the games through a reload and
deletes them.

**Phase 4. The history page**

- [x] 14. The games' tree, `historyTree.ts` (agent): from the filtered records, with games,
  wins, draws and losses at each position, siblings sorted by count then UCI, and single-game
  tails pruned past a named constant so the views can draw it. It feeds `buildViewTree`
  (`src/lib/books/viewTree.ts`), whose `games` count already weights the views. FENs come
  from the move player (step 6). Done 2026-10-21. chess.js names a move in about 0.11 ms, 1.3 s for
  the 12,000 positions of the user's 3,264 games, so the move player gained `uciToSan`, which
  matches chess.js on every fixture and random game at about 7 µs a position. A line only one
  game took is drawn for `HISTORY_TAIL_PLIES` (1) ply: the user's games draw 5,436 positions, 8,678
  at 2 plies. `PositionNames` keeps positions and names between builds.
- [x] 15. Walking the views (agent, D31, D32), in `BookView` for all five views: the arrow keys
  with the highlighted move, the camera that pans and zooms to keep the current position and its
  moves in frame, dragging to pan, the zoom scale from 0.5 to 4 with its finer steps, and the
  marks that keep their size below 1 (D32 as amended). The rules (which move is highlighted, where the camera goes) are
  pure functions in `src/lib/books/views/`, tested in Node. `DEFAULT_READER_VIEW` splits into
  a first-level default (the icicle) and a second-level one (ply columns). `docs/design/explorer.md`
  gains both. Done 2026-10-21: `camera.ts` (`walkKey`, `frameCamera`, `easeCamera`), `zoom.ts` on
  the continuous scale, and `useViewZoom`, which the views' `ZoomControls` share. The camera
  zooms on its own only when the position changes, so a book opens at the zoom it was left at,
  not at 200%.
- [x] 16. The page, `/dashboard/library/history` (agent), open to guests like the rest of the
  Library, as a spread laid out by D30: on the left, the filters as D38 lays out, the
  totals bar, and the games through the current position, each with its link; on the right,
  the board with "Open in Explorer" and the moves played next in a box of fixed height, and
  the tree in ply columns weighted by games, under the "Your score" switch. The Library's
  first level shows the number of games and the way to the page (`deployment.md` D21). Done
  2026-10-21: `GameHistoryPage`, `HistoryFilters` and `HistoryPosition` (`src/components/library/`),
  on `historyFilter.ts` and `useHistoryGames`, as a whole spread (D30's framing). Ply columns paint
  the score (D35) through `BookView`'s `success`.
  *After the user's first look (2026-10-24):*
  - The Library's import report keeps "Open game history" and closes with a "Close" button, not
    a small ✕.
  - The page opens on the last 12 months up to the newest game (`recentGames`), which also keeps
    the first tree small.
  - The current position names its opening, and a move played next names one where it starts it.
  - The board draws an arrow for the highlighted move, or for the hovered one.
  - The list of moves played next scrolls to keep the highlighted one in view.
  - The arrow keys walk the tree from anywhere on the page (`BookView`'s `keysAnywhere`), as on a
    book's own page, unless a field, a menu or a dialog has them.
  
  The "Other" node the user asked about is Q23.

**Phase 5. Comparing games with a book**

- [x] 17. `compareWithBook.ts` (agent): for each game in the book's color, walks the book by
  UCI, rejoining it by position on a miss (D27), and records where the game left the book and
  who left it, or that it stayed in the book to the cutoff or ended inside it. At each book
  position it totals games, results, and exits by the user and by the opponent with their
  results (D10).
  Done 2026-10-24. A game off the book's move order is followed for `REJOIN_PLIES` (8) plies
  for a position to rejoin, so 1.c4 Nf6 2.d4 rejoins a 1.d4 Nf6 2.c4 book; otherwise its first
  move off the book is where it left. Games that reach a line's end, stay in the book to the
  cutoff, or end inside it are counted apart.
- [x] 18. The book's own page (agent, `src/components/library/LibraryBookPage.tsx`), laid out
  by D36: the choice of plain, your games (with which games, the panels of D38), or drills
  (disabled until the trainer exists) (D9); the book's facts, difficulty as `bookstore.md` D17
  and the rest as its Q6–Q8 settle them; a "where you leave this book" list, scrolling in its
  own box, that selects its position in the view; the selected position's games and results,
  in a panel that keeps its size.
  Done 2026-10-24 as D40 lays it out, on a whole spread: every Library second level is one
  (`WHOLE_SPREAD_CHAPTERS`, `src/lib/book/chapters.ts`).
  - The facts are `BookFacts`. The measured difficulty (`measuredDifficulty`) is the scale
    alone; no publisher's difficulty is stored yet, so it has one dot. Coverage stays off the
    page until the browser has master numbers.
  - Clashes opens `ClashesDialog`. The ticks live in the trees (D41, `src/lib/books/drills.ts`),
    the views dash unticked lines, and a resolved clash loses its ring everywhere.
  - Plain lists the contents (`bookContents`, `src/lib/books/contents.ts`). Your games is chosen
    by `BookGamesFilter`'s span and the history page's check boxes, and the page opens on it
    when the user has games.
  - With games, the drawing is painted by score and drawn as thick as its games (`thickness`)
    without changing its layout.
  - The book opens down its main line, as it did. Remove move stays, beside "Open in Explorer".
  - Not done: a publisher's difficulty, coverage, and the Library's first level showing
    clashes to resolve.
- [ ] 19. Success in color (agent), as `deployment.md` D21 lays out: `BookView` takes success per
  position and paints it, leaving layouts unchanged. First ply columns, as D35 says; then
  branch points and spine and ribs; then the metro map's red-to-green mark; then the icicle's
  texture.

**Phase 6. Finishing**

- [ ] 20. Docs (agent): the history tables and records in `docs/architecture.md`, the history
  page and the book page's views in `docs/design/dashboard.md`, `src/lib/history/` in
  `AGENTS.md`'s "Where things live". Finished phases fold into one line each.
- [ ] 21. Browser tests (agent, then user commits, then the test-reviewer agent): a guest
  imports a fixture, moves to another page while it runs and sees the toast, and checks the
  report, the history page, the arrow keys and a book page's games view; the same for an
  account. Chromium while working, every browser in a review.

**Phase 7. Fetching by username (D42)**

- [ ] 22. Check both sites (agent): their docs on keys and rate limits, the profile and games
  endpoints, whether the profile requests allow other sites (CORS), and Lichess's export from
  a browser. Findings go in Notes, and D42 is corrected where it was wrong.
- [ ] 23. Mockup (agent, then user): the import dialog with fetch and file first, paste
  second, the profile card (D43) and the link to Settings' tutorial.
- [ ] 24. The fetcher (agent), `src/lib/history/fetchGames.ts`: the pure parts tested in Node
  (the month and export addresses, pacing, waiting after a 429), and the browser part that
  streams each response into the import worker as text. Then the dialog, as the mockup is
  approved.
- [ ] 25. Settings' tutorial (agent): the steps for each site's download, linking to the
  sites' own pages.

**Later, not in these steps:** the Explorer's "your games" mode (D12), other players' games
(D6), comments per position (D17), and copying a guest's history into an account at sign-in.

## Notes

**Measured 2026-10-21** on the user's Chess.com archive (3,322 games, 58 of them Chess960 or
from a set-up position) and Magnus Carlsen's last 500 Lichess games. Sizes are per game,
compressed with gzip in groups of 1,000. Postgres compresses less well than gzip, so expect
the stored size to be up to about twice these.

| Per game | User (Chess.com) | Magnus (Lichess) |
|---|---|---|
| Raw PGN | 2,429 B (1,038 B of it clock comments) | 4,202 B (1,195 B clocks, 1,037 B evals) |
| Plies: mean, median | 66, 61 | 85, 81 |
| Whole game: details, UCI moves, time per move | ~200 B | ~200 B |
| First 60 plies, the same fields | 172 B | 148 B |
| First 40 plies | 128 B | 103 B |
| First 30 plies | 100 B | 78 B |
| chess.js replay of a whole game | 15 ms | 19 ms |

- The compact record is what saves the space: 2.4 KB of PGN becomes about 0.2 KB. The move
  cutoff halves it again at most. Clock comments are large because `{[%clk 0:04:59.6]}` is
  about 20 characters for one number.
- Time controls are varied: the user's games have 17 distinct values.
- 100 users × 10,000 games (D18) × 40 plies is about 130 MB compressed, up to about 260 MB
  stored. That still fits the free tier's 500 MB, with less room left for puzzles and drills
  (D15).

**Storage prices (checked 2026-10-21)**

| Option | Cost | Trade-off |
|---|---|---|
| Supabase free (today) | $0: 500 MB database, 1 GB file storage | Enough for the beta at D16 and D18's numbers |
| Supabase Pro | $25 a month: 8 GB database, then $0.125 per GB a month; 100 GB file storage | Same code; a spend cap is on by default |
| Cloudflare R2 or Supabase Storage (object storage) | R2: 10 GB free, then $0.015 per GB a month, no download fees | Cheapest per GB, but files can't be checked or queried by the database, and access rules are a second system |
| Another database (Neon, Turso and the like) | Free tiers of a similar size | Loses Supabase Auth's row rules, so the access rules move into code |
| The browser only | $0 | Doesn't follow the user to another device, and Safari deletes it after 7 days without a visit |

**Earlier work on storing games**

- Lichess stores each move as its index in an ordered list of legal moves, then compresses
  the indexes, at a few bits per move. Others reach 3.7 bits.
- Lichess's personal opening explorer keeps no games. It indexes a player's games on demand
  into per-position counts, keyed by a hash of the position, the player and the side, then
  the month, in RocksDB. That is the shape the Explorer's "your games" mode (D12) needs.
- ChessBase and SCID write games one after another in a compressed file, with a fixed-width
  index file and a separate file of names.
- Games grouped by their shared opening moves form a prefix tree (a trie), the same shape as
  a book's `MoveNode` tree. Here it is built in the browser from the records (D19).

**Why the server checks everything:** the Web Worker runs in the user's browser, so its owner
can change it, or skip it and call the API directly. It is a convenience, not a security
boundary. Whatever arrives lands only in the sender's own rows.

**Sources:** Supabase pricing (supabase.com/pricing), Cloudflare R2 pricing (third-party
summaries), Lichess's developer update on game compression, mbuffett.com on 3.7 bits per
move, Lichess's announcement of the personal opening explorer, and the lila-openingexplorer
repository.
