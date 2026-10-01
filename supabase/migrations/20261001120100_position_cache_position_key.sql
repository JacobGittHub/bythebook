-- Key the explorer cache by position (a FEN without its two move counters), so a position
-- reached by another move order is the same row (plans/deployment.md, D7).

-- Several full FENs can be one position. Keep the newest row of each.
delete from public.position_cache as older
using public.position_cache as newer
where array_to_string((string_to_array(older.fen, ' '))[1:4], ' ')
    = array_to_string((string_to_array(newer.fen, ' '))[1:4], ' ')
  and (coalesce(older.cached_at, 'epoch'), older.fen)
    < (coalesce(newer.cached_at, 'epoch'), newer.fen);

update public.position_cache
set fen = array_to_string((string_to_array(fen, ' '))[1:4], ' ');

alter table public.position_cache rename column fen to position_key;
