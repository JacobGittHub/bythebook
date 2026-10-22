-- A signed-in user's game history (plans/game-history.md, Phase 3: D15, D18, D37). Games are kept
-- in chunks of up to 1,000, in the order they were imported, with one summary row per user.
-- Owners read their own rows, and nothing is written through the API: the history routes check
-- each write and call the functions below with the service role, after taking the user from the
-- session, so the checks and the limit can't be skipped by writing to the tables directly.

create table public.game_history (
  user_id uuid primary key references auth.users (id) on delete cascade,
  games integer not null default 0 check (games >= 0),
  -- Each chunk's number, game count and the version that last wrote it, in order.
  chunks jsonb not null default '[]'::jsonb,
  -- The imports with games still kept, oldest first.
  imports jsonb not null default '[]'::jsonb,
  username text check (char_length(username) <= 100),
  last_import_at timestamptz,
  -- Goes up with every write, so a write planned from an older read is refused.
  version bigint not null default 0
);

create table public.game_history_chunks (
  user_id uuid not null references auth.users (id) on delete cascade,
  n integer not null check (n >= 0),
  -- The games' records, each with the import it came in.
  games jsonb not null,
  -- The time spent on each kept ply, one list per game, in the same order.
  clocks jsonb not null,
  game_count integer not null check (game_count between 1 and 1000),
  -- The history's version that wrote it, so a browser's copy fetches only chunks that changed.
  version bigint not null,
  primary key (user_id, n)
);

-- The chunks of a write still being sent, one request each, since a write can be larger than a
-- request may be. A commit takes those planned from its own version; the next write replaces any
-- left by an import abandoned midway.
create table public.game_history_staged (
  user_id uuid not null references auth.users (id) on delete cascade,
  n integer not null check (n >= 0),
  base_version bigint not null,
  games jsonb not null,
  clocks jsonb not null,
  game_count integer not null check (game_count between 1 and 1000),
  -- The imports its games name, which the commit checks against the list of imports.
  import_ids bigint[] not null,
  staged_at timestamptz not null default now(),
  primary key (user_id, n)
);

-- Games allowed per account where the default isn't enough (D18). The user sets a row in the SQL
-- editor, as when granting a request below.
create table public.account_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  games integer not null check (games between 0 and 1000000)
);

-- Requests for more room (D37). The user reads them in the SQL editor, sets the account's
-- account_limits row, and marks the request granted or declined.
create table public.game_limit_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  games integer not null check (games between 1 and 50000),
  reason text not null default '' check (char_length(reason) <= 200),
  status text not null default 'pending' check (status in ('pending', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

-- One pending request per account.
create unique index game_limit_requests_one_pending
  on public.game_limit_requests (user_id) where status = 'pending';
create index game_limit_requests_user_created_idx
  on public.game_limit_requests (user_id, created_at desc);

alter table public.game_history enable row level security;
alter table public.game_history_chunks enable row level security;
alter table public.game_history_staged enable row level security;
alter table public.account_limits enable row level security;
alter table public.game_limit_requests enable row level security;

-- Owners read their own rows. No policy writes, and staged chunks have none at all: only the
-- service role, on the server, reads or writes them.
create policy "read own game history" on public.game_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own game history chunks" on public.game_history_chunks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own account limit" on public.account_limits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own limit requests" on public.game_limit_requests for select to authenticated
  using ((select auth.uid()) = user_id);

-- Stages one chunk of a write planned from p_base_version. Returns 'staged', 'stale' when the
-- history has moved on since, or 'full' when p_cap chunks are already staged.
create function public.stage_game_history_chunk(
  p_user_id uuid,
  p_base_version bigint,
  p_n integer,
  p_games jsonb,
  p_clocks jsonb,
  p_game_count integer,
  p_import_ids bigint[],
  p_cap integer
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  current_version bigint;
begin
  insert into public.game_history (user_id) values (p_user_id) on conflict (user_id) do nothing;
  -- The summary row's lock keeps a user's stages and commits in order.
  select version into current_version from public.game_history where user_id = p_user_id for update;
  if current_version <> p_base_version then
    return 'stale';
  end if;
  delete from public.game_history_staged where user_id = p_user_id and base_version <> p_base_version;
  if (select count(*) from public.game_history_staged where user_id = p_user_id and n <> p_n) >= p_cap then
    return 'full';
  end if;
  insert into public.game_history_staged (user_id, n, base_version, games, clocks, game_count, import_ids)
  values (p_user_id, p_n, p_base_version, p_games, p_clocks, p_game_count, p_import_ids)
  on conflict (user_id, n) do update
    set base_version = excluded.base_version,
        games = excluded.games,
        clocks = excluded.clocks,
        game_count = excluded.game_count,
        import_ids = excluded.import_ids,
        staged_at = now();
  return 'staged';
end;
$$;

-- Commits a write planned from p_expected_version: the staged chunks p_written replace their
-- stored ones, p_deleted go, and the summary takes the values the route checked. Returns the new
-- version, or null when the history has moved on or a chunk named wasn't staged from that version.
-- Raises when the stored games then don't match the summary or break the limit, which undoes it.
create function public.commit_game_history(
  p_user_id uuid,
  p_expected_version bigint,
  p_written integer[],
  p_deleted integer[],
  p_games integer,
  p_chunks jsonb,
  p_imports jsonb,
  p_username text,
  p_last_import_at timestamptz,
  p_limit integer,
  p_cap integer
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  current_version bigint;
  total integer;
  chunk_count integer;
begin
  insert into public.game_history (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select version into current_version from public.game_history where user_id = p_user_id for update;
  if current_version <> p_expected_version then
    return null;
  end if;
  if (
    select count(*) from public.game_history_staged
    where user_id = p_user_id and base_version = p_expected_version and n = any(p_written)
  ) <> coalesce(cardinality(p_written), 0) then
    return null;
  end if;

  delete from public.game_history_chunks where user_id = p_user_id and n = any(p_deleted);
  insert into public.game_history_chunks (user_id, n, games, clocks, game_count, version)
  select user_id, n, games, clocks, game_count, p_expected_version + 1
  from public.game_history_staged
  where user_id = p_user_id and n = any(p_written)
  on conflict (user_id, n) do update
    set games = excluded.games,
        clocks = excluded.clocks,
        game_count = excluded.game_count,
        version = excluded.version;
  delete from public.game_history_staged where user_id = p_user_id;

  select coalesce(sum(game_count), 0), count(*) into total, chunk_count
  from public.game_history_chunks where user_id = p_user_id;
  if total <> p_games or total > p_limit or chunk_count > p_cap then
    raise exception 'The game history write breaks its rules.' using errcode = 'check_violation';
  end if;

  update public.game_history
  set games = p_games,
      chunks = p_chunks,
      imports = p_imports,
      username = p_username,
      last_import_at = p_last_import_at,
      version = p_expected_version + 1
  where user_id = p_user_id;
  return p_expected_version + 1;
end;
$$;

-- Deletes every game, and returns the new version, which keeps counting so that a write planned
-- before the deletion is refused.
create function public.clear_game_history(p_user_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  next_version bigint;
begin
  insert into public.game_history (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from public.game_history where user_id = p_user_id for update;
  delete from public.game_history_chunks where user_id = p_user_id;
  delete from public.game_history_staged where user_id = p_user_id;
  update public.game_history
  set games = 0, chunks = '[]'::jsonb, imports = '[]'::jsonb, username = null, last_import_at = null,
      version = version + 1
  where user_id = p_user_id
  returning version into next_version;
  return next_version;
end;
$$;

revoke execute on function public.stage_game_history_chunk(uuid, bigint, integer, jsonb, jsonb, integer, bigint[], integer)
  from public, anon, authenticated;
revoke execute on function public.commit_game_history(uuid, bigint, integer[], integer[], integer, jsonb, jsonb, text, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.clear_game_history(uuid) from public, anon, authenticated;
