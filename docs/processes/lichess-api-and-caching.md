# Lichess API: call chain and caching

**Last reviewed:** 2026-10-01
**Files:**

- `src/app/api/openings/explorer/route.ts` is the only route that reaches Lichess. It
  validates, calls `getExplorerDataForUser`, and maps errors to status codes.
- `src/lib/chess/explorerService.ts` decides between the cache and Lichess
  (`getExplorerData`) and who may reach Lichess (`getExplorerDataForUser`).
- `src/lib/chess/lichessExplorer.ts` is the HTTP client. It adds the token and throws on
  errors.
- `src/lib/chess/explorerData.ts` holds the pure helpers shared by server and client:
  `EXPLORER_MOVES_LIMIT`, `EXPLORER_DISPLAY_MOVES`, `normalizeCastling`,
  `isCacheEntryCurrent` and `forDisplay`.
- `src/lib/db/positionCache.ts` reads and writes `position_cache`.
- `src/lib/db/usage.ts` (`recordUsage`) counts calls in `usage_counters`.
- `src/lib/chess/cachePrefill.ts` and `scripts/prefillPositionCache.ts` fill the cache from
  a local machine.
- The client consumers are `src/hooks/useOpeningExplorer.ts`,
  `src/hooks/useOpeningExplorerMulti.ts` and the region map's `src/lib/regions/loader.ts`.

## Overview

Client code never calls Lichess directly. Every request goes through one route, which
checks `position_cache` and calls Lichess only on a cache miss, and only for a signed-in
user. A guest gets what the cache holds and nothing else. The cache is permanent, because
master-game statistics for a position don't change. It is one table shared by everyone: it
grows as signed-in users explore, and the pre-fill script loads the whole catalog into it.

## Flow

```
Client: fetch('/api/openings/explorer', POST { fen })   (GET ?fen= also works)
  ▼
route.ts
  1. getAuthenticatedUser(). No user means a guest, not a 401.
  2. Zod-parse the FEN. normalizeFen() only trims it and maps "startpos" to the start FEN.
  3. getExplorerDataForUser(fen, user id or null), then return { fen, ...data, cached }.
     A null result returns 404.
  ▼
getExplorerDataForUser(fen, userId)   explorerService.ts
  recordUsage(userId, "explorer")
  getExplorerData(fen, gate)   the gate refuses guests, and counts "lichess" for users
  ▼
getExplorerData(fen, mayFetchLive)
  getCachedPosition(fen)   admin client (service role)
  │  SELECT explorer_data FROM position_cache WHERE position_key = toPositionKey($fen),
  │  then Zod-validate it
  ├─ HIT, current (isCacheEntryCurrent) → normalizeCastling → cached: true
  └─ MISS, or a row cached by older code (no totals, or movesLimit < EXPLORER_MOVES_LIMIT)
       ▼
     mayFetchLive()
       └─ false → the old row if there is one (cached: true), otherwise null
       ▼
     fetchExplorerMoves(fen)
       GET https://explorer.lichess.ovh/masters?fen=<FEN>&moves=<EXPLORER_MOVES_LIMIT>
       Authorization: Bearer <LICHESS_API_TOKEN>
       ├─ 429       → throws LichessRateLimitError(retry-after, default 60 s)
       ├─ other !ok → throws Error (this includes a 401 from a missing or expired token)
       └─ 200       → { moves, opening, totals, movesLimit }
       │  If it throws and an old row exists, that row is served instead (cached: true).
       ▼
     normalizeCastling → setCachedPosition(fen, data)   admin client (service role) upsert
       ▼
     cached: false

Errors: not cached, for a guest → 404 · rate limit → 429 with Retry-After · Zod → 400 ·
anything else → 500
```

## Details worth knowing

- **What a row holds.** The listed moves (up to `EXPLORER_MOVES_LIMIT`, most played first),
  the opening name, the position's `totals` (every game, including moves beyond the listed
  ones), and the `movesLimit` it was fetched with. Lichess honoured 20 moves when this was
  checked on 2026-09-29; asking for more returns every move the database has.
- **The cache key is `toPositionKey(fen)`,** the FEN without its two move counters. The same
  position reached by another move order is therefore the same row and one Lichess call.
  Callers pass a full FEN; `positionCache.ts` derives the key, and Lichess is still sent the
  full FEN. This matters most to guests, who can't recover from a miss.
- **Old rows migrate lazily.** Rows cached before totals were kept have no `totals` or
  `movesLimit`. `getExplorerData` refetches and overwrites each one the first time a
  signed-in user requests it, so no SQL migration was needed. If `EXPLORER_MOVES_LIMIT` is
  raised again, rows refetch the same way. A guest is served the old row as it is. The Zod
  schema in `positionCache.ts` must list every field, because `z.object` drops unknown keys.
- **The existing UI still shows 12 moves.** `useOpeningExplorer` and
  `useOpeningExplorerMulti` pass responses through `forDisplay`, which trims them to
  `EXPLORER_DISPLAY_MOVES`. Several screens add up the listed moves to get their "total
  games", so trimming in the hooks keeps every number they show unchanged. The region map
  uses the full list and the real totals.
- **Castling normalization.**
  - Lichess returns castling moves as king-to-rook (`e1h1`, `e1a1`, `e8h8`, `e8a8`), but
    chess.js expects king-to-destination (`e1g1` and so on).
  - `getExplorerData` rewrites these on both the hit and miss paths. Any new consumer of raw
    Lichess data needs the same fix.
- **Writes overwrite.** `setCachedPosition` upserts, so racing requests just rewrite the same
  row.
- **Access.** The server reads and writes the table with the admin client, because a guest
  has no session to read with and the table holds nothing private. The admin client is
  server-side only. If `SUPABASE_SERVICE_ROLE_KEY` is missing, every explorer request
  returns 500.
- **No expiry.** If Lichess ever re-indexes its masters database, clear the table manually.

## Authentication

- **Since March 2026 the masters endpoint requires a personal API token,** because of DDoS
  protection. The token is `LICHESS_API_TOKEN`, a server-only env var.
- **A missing token logs a warning and the request is sent anyway.** It then fails, and the
  route returns 500.

## Counting

- Every explorer request adds one to the `explorer` count for its user and day, and every
  Lichess request adds one to `lichess`. Guests share one row. The other route handlers
  count themselves under the other `UsageKind` values.
- `recordUsage` never fails a request: on an error it logs and returns null.
- The counts are collected so that per-user ceilings can be chosen from real numbers
  (`plans/deployment.md`, D8). Nothing is refused on a count yet.

## Pre-fill

- `npm run cache:prefill` visits every catalog position (`listCatalogFens`) through the
  same `getExplorerData`, one position at a time, with a pause after each Lichess call.
  Positions already cached are skipped, so it can be stopped and run again. Its options are
  listed at the top of `scripts/prefillPositionCache.ts`.
- `--min-games` also follows every move played in at least that many games, breadth-first,
  which fills positions beyond the catalog.
- It runs locally with `.env.local`, never on Vercel. A 429 pauses it for at least
  `RATE_LIMIT_MIN_WAIT_SECONDS`, and `MAX_CONSECUTIVE_FAILURES` failures in a row stop it.
- It also supplies the game counts that the `games` weight mode needs (see the storage gaps
  in `architecture.md`).

## Consumers and failure behavior

| Consumer | When it calls | On error |
|---|---|---|
| `useOpeningExplorer` | Whenever the Explorer board's FEN changes (one call) | Sets `error` to the status code, and the component decides what to show |
| `useOpeningExplorerMulti` | Explorer history positions, in parallel (`Promise.all`) | Silently maps that position to `null` |
| `DashboardTree` ghost expansion | When a dashboard node is clicked, via `useOpeningExplorer` | Same as `useOpeningExplorer` |
| Region map (`src/lib/regions/loader.ts`) | For blobs on screen, biggest first, at most `EXPLORER_MAX_IN_FLIGHT` at once | A 429 pauses every request for its `Retry-After`. Other failures mark the position failed and it may be asked again after `FAILED_RETRY_MS` |

- **Failures are quiet.** A cold cache combined with a Lichess 429 or an expired token makes
  the mini tree and ghost expansions render with no moves, and the app stays usable. There
  is no server-side logging of 429s and no user-facing error beyond the hook's `error`
  state.
- **No page lets a guest in yet.** `src/proxy.ts` still requires a session for every
  dashboard page, so only the route itself serves guests. When guests are let in, the
  consumers above need to treat a 404 as "not cached" and not as a failure to retry.

## Scaling

- **Current scale is 2–50 users.** Only cold positions are expensive; after the first
  request, every user gets the cached row from Supabase.
- **Storage is not a concern.** At roughly 5 KB per row, the 500 MB free tier holds about
  100,000 positions. The catalog reaches fewer than 8,000.
- **What breaks first:**
  1. **Lichess rate limits**, when many users hit new positions at once. The pre-fill
     mitigates this. The region map asks for many positions as the user zooms, but its
     loader keeps at most `EXPLORER_MAX_IN_FLIGHT` open and backs off on a 429. The lazy
     refetch of old rows is a one-time cost per row.
  2. **`useOpeningExplorerMulti` fan-out.** One Explorer mount can fire 10–40 parallel
     requests, and each is a function call plus a count write. That is fine now, but query
     batching would be needed at hundreds of concurrent users.
