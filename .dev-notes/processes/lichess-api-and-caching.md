# Lichess API: call chain and caching

**Last reviewed:** 2026-09-29
**Files:**

- `src/app/api/openings/explorer/route.ts` is the only route that reaches Lichess.
- `src/lib/chess/lichessExplorer.ts` is the HTTP client. It adds the token and throws on
  errors.
- `src/lib/db/positionCache.ts` reads and writes `position_cache`.
- `src/hooks/useOpeningExplorer.ts` and `src/hooks/useOpeningExplorerMulti.ts` are the
  client consumers.

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
  ▼
getCachedPosition(fen)   server client (the user's session; RLS read)
  │  SELECT explorer_data FROM position_cache WHERE fen = $fen, then Zod-validate it
  ├─ HIT  → normalizeCastling → { fen, moves, opening, cached: true }
  └─ MISS
       ▼
     fetchExplorerMoves(fen)
       GET https://explorer.lichess.ovh/masters?fen=<FEN>&moves=12
       Authorization: Bearer <LICHESS_API_TOKEN>
       ├─ 429       → throws LichessRateLimitError(retry-after, default 60 s)
       ├─ other !ok → throws Error (this includes a 401 from a missing or expired token)
       └─ 200       → { moves, opening }
       ▼
     normalizeCastling → setCachedPosition(fen, data)   admin client (service role) upsert
       ▼
     { fen, moves, opening, cached: false }

Errors: rate limit → 429 with Retry-After · Zod → 400 · anything else → 500
```

## Details worth knowing

- **Castling normalization.**
  - Lichess returns castling moves as king-to-rook (`e1h1`, `e1a1`, `e8h8`, `e8a8`), but
    chess.js expects king-to-destination (`e1g1` and so on).
  - The route rewrites these on both the hit and miss paths. Any new consumer of raw Lichess
    data needs the same fix.
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
     mitigates this.
  2. **`useOpeningExplorerMulti` fan-out.** One Explorer mount can fire 10–40 parallel
     requests. That is fine now, but query batching would be needed at hundreds of
     concurrent users.
