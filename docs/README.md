# docs

Design and architecture docs for ByTheBook. Like `AGENTS.md`, this folder is version
controlled, and the repository is public, so never put secrets or keys here.

When to read each doc is in `AGENTS.md` under "Read before working on…". Keep that table as
the only index; `docs.test.ts` fails when a doc is missing from it.

- `architecture.md` explains why the system is built the way it is.
- `design/` holds one doc per feature or visualization, both live and candidate.
- `processes/` holds runtime call chains that span several files.
- `agent-context-map.md` covers what an agent reads before it works, and what that costs.
- `docs.test.ts` checks these docs, `AGENTS.md` and the plans index against the repository.

**What goes where.** Each fact lives in one place, and the others point to it.

| Kind of fact | Home |
|---|---|
| A rule an agent must follow | `AGENTS.md`, one line, pointing to its reasoning |
| How the system works and why | `docs/` |
| Where the project is going, and work not done yet | `plans/` |
| A value (a constant, a count, a list of files) | The code; docs name it |

**The docs test.** It reads every backticked name in `AGENTS.md` and `docs/` and checks that
the file, folder, route, package or code name exists. Names the docs call planned or that live
outside the repository are listed at the top of the test; a planned name that starts to exist
fails the test, so the doc that calls it planned gets updated. For plans it checks only the
index and links between docs and plans, because plans name code that doesn't exist yet.
