# Agent context map

Last reviewed: 2026-10-01

What an agent reads before it starts implementing, and what that costs in context. Each tab
is one hop: the file above told the agent to read the file below. Siblings are alternatives.
This is a snapshot; re-measure when the agent docs or plans change.

**Reading the tree**

- `a.md + b.md` on one line: the agent knew up front it needed all of them.
- `‹b›` on a child: file `b` in the multi-file line above is the one that asked for it.
- `=` lines are running totals once the docs are enough. `→` means implementation starts.
- Paths are shortened: `architecture.md`, `design/…` and `processes/…` live in `docs/`;
  `next:` is `node_modules/next/dist/docs/01-app/`; `src/` is dropped from source paths.

```
AGENT  harness ≈20k + AGENTS.md 2.7k (auto-loaded) + plans/README.md 0.6k  = 23.3k
	plans/region-map.md 1.1k  (status: ready, steps written)
		Phase 3 · lab shell  [frontend]
			design/lab-prototypes.md 2.8k + design/region-map.md 4.0k + next:02-guides/lazy-loading.md 2.7k
			= docs 9.5k, context 33.9k
			= src (components/lab/LabHarness.tsx, components/lab/ChessMap.tsx, components/lab/GlobeTest.tsx) 18.9k
			= context 52.8k  →  implement
		Phase 4 · RegionMap core  [frontend + pure layout code]
			architecture.md 4.2k + design/region-map.md 4.0k
				‹region-map› processes/lichess-api-and-caching.md 1.8k
			= docs 10.0k, context 34.4k
			= src (lib/regions/*.ts non-test, layout.test.ts, geometry.test.ts, components/lab/LabHarness.tsx,
			       components/lab/ChessMap.tsx, lib/chess/fen.ts) 24.0k
			= context 58.4k  →  implement
	plans/deployment.md 2.0k  (status: deciding, steps not written; paths below are projected)
		Q1 · accounts and invite codes  [database + auth]
			architecture.md 4.2k + next:01-getting-started/16-proxy.md 0.9k + next:01-getting-started/15-route-handlers.md 2.1k
			= docs 7.2k, context 32.5k
			= src (app/auth/register/page.tsx, app/auth/login/page.tsx, proxy.ts, lib/supabase.ts, lib/db/users.ts,
			       app/api/user/route.ts, lib/validators/schemas.ts, types/database.ts, supabase/migrations/*) 8.5k
			= context 41.0k  →  implement
		Q2 · guest book storage  [frontend]
			architecture.md 4.2k + design/explorer.md 1.4k + design/opening-tree.md 0.8k
			= docs 6.4k, context 31.7k
			= src (components/openings/OpeningExplorer.tsx, components/repertoire/DashboardTree.tsx,
			       components/repertoire/BookEditor.tsx, app/dashboard/library/page.tsx, app/api/openings/books/**,
			       lib/db/openings.ts, lib/chess/moveTree.ts, types/chess.ts, lib/validators/schemas.ts) 21.5k
			= context 53.2k  →  implement
		Q3 · guest explorer and cache pre-fill  [API]
			architecture.md 4.2k + processes/lichess-api-and-caching.md 1.8k + next:01-getting-started/15-route-handlers.md 2.1k
			= docs 8.1k, context 33.4k
			= src (app/api/openings/explorer/route.ts, lib/chess/explorerService.ts + test, lib/chess/explorerData.ts,
			       lib/chess/lichessExplorer.ts, lib/db/positionCache.ts, lib/chess/openingCatalog.ts, lib/chess/fen.ts,
			       hooks/useOpeningExplorer.ts, hooks/useOpeningExplorerMulti.ts, proxy.ts,
			       scripts/buildOpeningCatalogIndex.mjs) 8.1k
			= context 41.5k  →  implement
```

**What the numbers say**

- Every path starts implementing at 41k–58k tokens. The fixed 23.3k at the root is 40–57% of
  that, the task's docs are 6–10k, and source files are the part that varies (8–24k).
- The largest single reads are `OpeningExplorer.tsx` (11.7k), `GlobeTest.tsx` (8.4k),
  `LabHarness.tsx` (5.3k), `ChessMap.tsx` (5.1k) and the generated `types/database.ts` (4.3k).
- Next.js docs are the easiest cost to inflate. The getting-started pages used above are
  0.9–2.7k each; the full references are far larger (`proxy.md` 7.4k, `route.md` 5.0k,
  `upgrading/version-16.md` 9.9k).
- `lib/chess/generated/openingCatalogIndex.json` is about 3.5M tokens. An agent must never
  read it whole.

**How the estimates were made**

- Docs are file bytes ÷ 4; source is bytes ÷ 3.5, which allows for line numbers.
- The 20k harness figure (system prompt, tool definitions, skill list) is an estimate from one
  Claude Code session in VS Code, not a measurement. It changes with the tools and MCP
  servers enabled.
- Source lists are a judgement of what each task needs, not a trace of a real run.
- The totals are context at the moment implementation begins. Edits, test output and re-reads
  add to it afterwards.
