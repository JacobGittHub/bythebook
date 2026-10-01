# Bookstore, repertoires and library files

Status: deciding · Updated: 2026-10-01 · Depends on: deployment.md

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
- D2. Books and repertoires can be exported and imported as files, without adding load to
  the back end. Export files carry a version number. A new account can upload earlier
  books, repertoires or libraries.
- D3. Shared book codes and publicly uploaded books may follow. They are not in this plan.
- D4. The library interface comes from `deployment.md` Phase 4. This plan builds on it and
  replaces the "coming soon" prompts that phase ships.

## Open questions

### Q1. Where do the default books come from?

**Recommendation:** from the catalog, in the browser. A short hand-written list gives each
default book a name, a color and a rule such as "every catalog line whose name starts with
Queen's Gambit". The tree is built from those lines when the user opens the Bookstore, so
the server stores nothing. You curate the list.

> ME:

### Q2. Is a Bookstore book copied or linked?

**Recommendation:** copied into the library. The user can then edit it like any book, and
later changes to the default don't reach their copy.

> ME:

### Q3. How is a repertoire stored?

**Recommendation:** as a name, a color and a list of book ids. Its tree is worked out in the
browser by merging its books move by move, and is never stored. Signed-in users get one row
per repertoire in a new table.

> ME:

### Q4. What if two books in a repertoire answer the same position differently?

**Recommendation:** keep both moves. The trainer accepts either, and the repertoire view
marks the position so the user can see the clash.

> ME:

### Q5. What does an export file hold?

**Recommendation:** one JSON file with a format name, a version number, and lists of books
and repertoires, with room for game history and drill statistics later. The user can export
one book, one repertoire with its books, or the whole library.

> ME:

## Steps

Not written yet. Once Q1–Q5 are answered, the agent drafts them in plan mode.

## Notes

- Export and import run entirely in the browser. Import validates the file and replays
  every move with chess.js instead of trusting the file's positions, with a cap on file size
  and positions. A bad file can only affect the person importing it, and the server
  validates again when local books are copied into an account.
- Safari deletes a site's saved data after 7 days without a visit, which is why export and
  import matter to guests.
- `buildMoveTreeFromLines` and `mergeMoveLineIntoTree` (`src/lib/chess/moveTree.ts`) already
  merge lines into a tree keyed by move sequence, which is what Q1 and Q3 need.
- The trainer is still a placeholder, so "drilled the same way" means here that a repertoire
  has the same shape as a book. Drilling itself belongs to a trainer plan.
