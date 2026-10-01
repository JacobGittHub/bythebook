# Lichess API: call chain and caching

**Last reviewed:** 2026-09-29
**Files:**

- `src/app/api/openings/explorer/route.ts` is the only route that reaches Lichess. It
  validates, calls `getExplorerData`, and maps errors to status codes.
- `src/lib/chess/explorerService.ts` (`getExplorerData`) decides between the cache and
  Lichess.
- `src/lib/chess/lichessExplorer.ts` is the HTTP client. It adds the token and throws on
  errors.
- `src/lib/chess/explorerData.ts` holds the pure helpers shared by server and client:
  `EXPLORER_MOVES_LIMIT`, `EXPLORER_DISPLAY_MOVES`, `normalizeCastling`,
  `isCacheEntryCurrent` and `forDisplay`.
- `src/lib/db/positionCache.ts` reads and writes `position_cache`.
- The client consumers are `src/hooks/useOpeningExplorer.ts`,
  `src/hooks/useOpeningExplorerMulti.ts` and the region map's `src/lib/regions/loader.ts`.

## Overview

Client code never calls Lichess directly. Every request goes through one route, which
requires a signed-in user, checks `position_cache`, and calls Lichess only on a cache miss.
The cache is permanent, because master-game statistics for a position don't change. It
grows on demand as users explore.

## Flow

```
Client: fetch('/api/openings/explorer', POST { fen })   (GET ?fen= also works)
  ▼
route.ts
  1. getAuthenticatedUser(). With no user, return 401.
  2. Zod-parse the FEN. normalizeFen() only trims it and maps "startpos" to the start FEN.
  3. getExplorerData(fen), then return { fen, ...data, cached }.
  ▼
getExplorerData(fen)   explorerService.ts
  getCachedPosition(fen)   server client (the user's session; RLS read)
  │  SELECT explorer_data FROM position_cache WHERE fen = $fen, then Zod-validate it
  ├─ HIT, current (isCacheEntryCurrent) → normalizeCastling → cached: true
  └─ MISS, or a row cached by older code (no totals, or movesLimit < EXPLORER_MOVES_LIMIT)
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

Errors: rate limit → 429 with Retry-After · Zod → 400 · anything else → 500
```

## Details worth knowing

- **What a row holds.** The listed moves (up to `EXPLORER_MOVES_LIMIT`, most played first),
  the opening name, the position's `totals` (every game, including moves beyond the listed
  ones), and the `movesLimit` it was fetched with. Lichess honoured 20 moves when this was
  checked on 2026-09-29; asking for more returns every move the database has.
- **Old rows migrate lazily.** Rows cached before totals were kept have no `totals` or
  `movesLimit`. `getExplorerData` refetches and overwrites each one the first time it is
  requested, so no SQL migration was needed. If `EXPLORER_MOVES_LIMIT` is raised again, rows
  refetch the same way. The Zod schema in `positionCache.ts` must list every field, because
  `z.object` drops unknown keys.
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
- **The cache key is the full FEN, including the clock fields.** It is *not*
  `toPositionKey()`. The same position reached with different move counters is therefore a
  separate cache row and a separate Lichess call.
  - The fix would be to key the cache on `toPositionKey(fen)` while still sending the full
    FEN to Lichess.
  - This is a known gap, not a design choice.
- **Writes overwrite.** `setCachedPosition` upserts, so racing requests just rewrite the same
  row.
  - If the write fails (for example because `SUPABASE_SERVICE_ROLE_KEY` is missing), the
    route returns 500 even though the Lichess call succeeded.
- **Access rules (RLS).** Authenticated users can read. Only the service role can write, and
  the admin client is server-side only.
- **No expiry.** If Lichess ever re-indexes its masters database, clear the table manually.

## Authentication

- **Since March 2026 the masters endpoint requires a personal API token,** because of DDoS
  protection. The token is `LICHESS_API_TOKEN`, a server-only env var.
- **A missing token logs a warning and the request is sent anyway.** It then fails, and the
  route returns 500.

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
- **Pre-warming would remove most cold misses.** A script that calls the route for every
  catalog FEN would do it. It would also feed the `games` weight mode (see the storage gaps
  in `architecture.md`).

## Scaling

- **Current scale is 2–50 users.** Only cold positions are expensive; after the first
  request, every user gets the cached row from Supabase.
- **Storage is not a concern.** At roughly 5 KB per row, the 500 MB free tier holds about
  100,000 positions. The named catalog is 3,690 positions.
- **What breaks first:**
  1. **Lichess rate limits**, when many users hit new positions at once. Pre-warming
     mitigates this. The region map asks for many positions as the user zooms, but its
     loader keeps at most `EXPLORER_MAX_IN_FLIGHT` open and backs off on a 429. The lazy
     refetch of old rows is a one-time cost per row.
  2. **`useOpeningExplorerMulti` fan-out.** One Explorer mount can fire 10–40 parallel
     requests. That is fine now, but query batching would be needed at hundreds of
     concurrent users.
