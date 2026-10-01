# Plans

Where ByTheBook is going and how it gets there. The user and agents edit these files
together: agents write proposals, the user annotates them, and the choices they settle
become decisions that later work follows.

`docs/` describes the system as it is. This folder describes work that hasn't happened
yet. The repository is public, so keep secrets out of here too.

**Focus:** `deployment.md` (the user sets this; agents work on the focus plan unless told
otherwise)

## Index

| Plan | Status | Depends on | Goal |
|---|---|---|---|
| [vision.md](vision.md) | living | — | The shared picture every plan serves |
| [deployment.md](deployment.md) | deciding | — | Public Vercel deployment for guests and about 100 beta users |
| [region-map.md](region-map.md) | ready | — | Finish the Regions tab in the Visual Lab (build phases 3–7) |

Statuses: `deciding` (open questions remain) · `ready` (steps written, not started) ·
`active` · `done` · `parked`.

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
4. When every step is done, the status becomes `done` and the plan's lasting facts move into
   `docs/` or `AGENTS.md`. The file stays as the record.

**Size.** Keep each plan under about 150 lines. Past that, trim the Notes or split the plan.
Split a plan when part of it could be finished on its own, and record the link in
"Depends on".
