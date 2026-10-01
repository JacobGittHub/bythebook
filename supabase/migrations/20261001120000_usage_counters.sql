-- Daily call counts per user and kind of call (plans/deployment.md, D8).
-- A null user_id is the one row all guests share.
create table public.usage_counters (
  user_id uuid references auth.users (id) on delete cascade,
  day date not null default current_date,
  kind text not null,
  calls integer not null default 0,
  constraint usage_counters_key unique nulls not distinct (user_id, day, kind)
);

-- No policies: only the service role, on the server, reads or writes this table.
alter table public.usage_counters enable row level security;

-- Adds one to today's count and returns the new count, in a single statement.
create function public.increment_usage(p_kind text, p_user_id uuid default null)
returns integer
language sql
set search_path = ''
as $$
  insert into public.usage_counters (user_id, day, kind, calls)
  values (p_user_id, current_date, p_kind, 1)
  on conflict on constraint usage_counters_key
  do update set calls = public.usage_counters.calls + 1
  returning calls;
$$;

revoke execute on function public.increment_usage(text, uuid) from public, anon, authenticated;
