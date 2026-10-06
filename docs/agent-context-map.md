# Agent context map

What an agent reads before it starts implementing, and what that costs in context. The
numbers change with every edit, so they aren't kept here: `npm run docs:sizes` prints the
current estimate for each agent doc and for the largest source files.

## The reading path

1. **Always loaded:** the harness (system prompt, tool definitions and skill list; roughly 20k
   tokens in VS Code, more with MCP servers) and `AGENTS.md`, through `CLAUDE.md`.
2. **Every task:** `plans/README.md`, then the plan being worked on and the plans it depends
   on.
3. **Per task:** the docs that the "Read before working on…" table in `AGENTS.md` names, and
   any Next.js guide the task needs from `node_modules/next/dist/docs/`.
4. **Source:** the files the task touches. This is the part that varies most.

## Keeping it small

- `AGENTS.md` loads in every session, so a line there costs more than a line anywhere else.
  A rule goes there in one line, and its reasoning goes in `docs/`.
- One fact, one place (`README.md` in this folder). A copy costs context twice and drifts.
- Source files are the largest reads. `OpeningExplorer.tsx` is the biggest; its move
  navigator is the separate `src/lib/chess/explorerNavigator.ts`.
- Prefer the Next.js getting-started pages (1–3k tokens) to the full API references (5–10k).
- Never read `src/lib/chess/generated/openingCatalogIndex.json` (about 3.5M tokens).
- Test output: `npm run test:changed` and `npm run test:agent` print one line per failure
  instead of one per test file, and stop at the first failure.

## How the estimates are made

Docs are bytes ÷ 4. Source is bytes ÷ 3.5, which allows for the line numbers the Read tool
adds. The harness figure is an estimate from one VS Code session, not a measurement.
