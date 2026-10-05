# Plans

Where ByTheBook is going and how it gets there. The user and agents edit these files
together: agents write proposals, the user annotates them, and the choices they settle
become decisions that later work follows.

`docs/` describes the system as it is. This folder describes work that hasn't happened yet,
and it holds the user's latest direction, which outranks `docs/` where they disagree ("When
sources disagree" in `AGENTS.md`). The repository is public, so keep secrets out of here too.

**Focus:** `deployment.md` (the user sets this; agents work on the focus plan unless told
otherwise)

## Index

| Plan | Status | Depends on | Goal |
|---|---|---|---|
| [vision.md](vision.md) | living | — | The shared picture every plan serves |
| [deployment.md](deployment.md) | active | — | Public Vercel deployment for guests and about 100 beta users |
| [region-map.md](region-map.md) | active | — | Finish the Labyrinth, the region map prototype |
| [data-delivery.md](data-delivery.md) | deciding | — | Shared data from static files and the CDN, with fewer function calls |
| [testing.md](testing.md) | deciding | — | CI on GitHub, with Vitest and Playwright each doing one job |
| [atlas.md](atlas.md) | deciding | region-map.md | A static, pre-generated region map built in reproducible editions |
| [bookstore.md](bookstore.md) | deciding | deployment.md | Default books, repertoires, and library export and import |
| [game-history.md](game-history.md) | deciding | deployment.md | Import a user's own games and show them on the app's displays |

Statuses: `deciding` (open questions remain) · `ready` (steps written, not started) ·
`active` · `done` · `parked` · `living` (never finishes, like the vision).

The index holds goals only. Progress and open questions live in each plan, so they can't
go stale here. `docs/docs.test.ts` checks that every plan is listed with the status its
header gives and that links between plans and docs resolve. It doesn't check the code a
plan names, since plans describe code that doesn't exist yet.

## How to write in these files

**The user annotates** by adding a blockquote that starts with `ME:`, anywhere in a file:

```markdown
> ME: agree, but let guests make 20 live Lichess calls a day
```

**Every plan has the same shape.** The sections above Notes are short and binding. Agents
read Notes only when they need the reasoning behind something.

```markdown
# <Plan name>

Status: deciding · Updated: YYYY-MM-DD · Depends on: —

**Goal:** one sentence.
**Done when:** a condition someone can check.

## Decisions

- D1. The choice, then why.

## Open questions

### Q1. The question?

**Recommendation:** the agent's pick and why, in two or three lines.

> ME:

## Steps

- [ ] A step (user | agent). Written once the open questions are settled.

## Notes

Background and reasoning.
```

**How a plan moves along.**

1. A question stays open until it has a `> ME:` answer. A recommendation on its own doesn't
   settle anything.
2. When an answer settles a question, the agent replaces the question with a decision that
   keeps the answer's reasoning. Agents don't otherwise rewrite or delete `> ME:` notes.
3. With every question settled, the agent drafts the Steps in plan mode, and the user
   approves them.
4. When a phase is done, its steps fold into a one-line "Done" summary that points to where
   its facts now live in `docs/` or `AGENTS.md`. When every step is done, the status becomes
   `done` and the file stays as the record.

**Size.** Plans grow and shrink with the work, so there is no hard limit. When one gets hard
to scan, fold finished phases (step 4), trim the Notes, or split off a part that could
finish on its own and record the link in "Depends on".
