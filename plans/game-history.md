# Game history import

Status: deciding · Updated: 2026-10-01 · Depends on: deployment.md

**Goal:** let a user import their own games and see them on the app's displays.
**Done when:** a user can import a file of their games in the browser and see their own move
counts beside the master stats in the explorer.

## Decisions

Carried over from the user's notes in `deployment.md` (D12, D13).

- D1. Users can import their game history when it is in a suitable format and size, so the
  app's displays can show it.
- D2. The import must not burden the back end, and it works for guests.
- D3. Later the library may hold game history alongside books, repertoires and drill
  statistics, so it can be exported and synced into an account.

## Open questions

### Q1. What format, and from where?

**Recommendation:** a PGN file the user uploads. Lichess and Chess.com both export PGN.
Fetching games by username from the Lichess API can come later.

> ME:

### Q2. How big can an import be?

**Recommendation:** 10,000 games or 25 MB per import to start. The file is parsed in a Web
Worker so the page stays responsive, and the lab is where these numbers get checked on a
slow device.

> ME:

### Q3. What is kept?

**Recommendation:** per-position counts, not the file. For each position in the first 15
moves of each game, the app keeps how often the user played each move and how those games
ended. That is a few megabytes at most, and it is what the displays need.

> ME:

### Q4. Which display shows it first?

**Recommendation:** the explorer's move list, with a "your games" column beside the master
stats. The dashboard tree and the region map can follow.

> ME:

### Q5. Which player is the user?

**Recommendation:** ask for a username at import, pre-filled with the name that appears in
the most games.

> ME:

### Q6. Does history sync to an account?

**Recommendation:** not at first. It stays in the browser and travels in the library export
file. Syncing means deciding how thousands of position counts fit the single-row rule
(`deployment.md` D1), which is its own question.

> ME:

## Steps

Not written yet. Once Q1–Q6 are answered, the agent drafts them in plan mode.

## Notes

- A PGN game is roughly 1 KB without clock comments and 2–3 KB with them, so 10,000 games
  from Lichess is 20–30 MB.
- chess.js reads one game at a time. A file of many games needs splitting first, or a PGN
  parser built for multi-game files.
- These numbers are estimates until the lab measures them.
