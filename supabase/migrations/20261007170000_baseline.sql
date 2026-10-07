-- The whole public schema of the live project on 2026-10-07, printed by
-- scripts/sql/schemaSnapshot.sql (plans/deployment.md, D28). The four migrations before this
-- one are already in it. The live project doesn't run this file; a new project (staging,
-- later) runs this file and the migrations after it, never the earlier ones. It expects
-- Supabase's own auth schema and roles to exist, as they do in every Supabase project.

-- Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1

create table public.access_codes (
  code_hash text not null,
  purpose text not null,
  user_id uuid,
  created_at timestamp with time zone default now() not null,
  claimed_at timestamp with time zone
);

create table public.drill_attempts (
  id uuid default gen_random_uuid() not null,
  drill_id uuid not null,
  user_id uuid not null,
  succeeded boolean not null,
  moves_played text[] default '{}'::text[] not null,
  attempted_at timestamp with time zone default now() not null
);

create table public.drills (
  id uuid default gen_random_uuid() not null,
  book_id uuid not null,
  user_id uuid not null,
  start_position_key text not null,
  mistake_move_uci text not null,
  punishment_line_uci text[] default '{}'::text[] not null,
  end_position_key text not null,
  mistake_depth smallint not null,
  eval_drop_cp smallint not null,
  difficulty_score real default 0.0 not null,
  generated_at timestamp with time zone default now() not null
);

create table public.opening_books (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  color text not null,
  move_node jsonb default '{}'::jsonb not null,
  is_public boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.position_cache (
  position_key text not null,
  explorer_data jsonb not null,
  cached_at timestamp with time zone default now()
);

create table public.position_evals (
  position_key text not null,
  depth smallint not null,
  eval_cp smallint,
  mate_in smallint,
  best_move_uci text not null,
  pv_uci text[] default '{}'::text[] not null,
  computed_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  username text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.puzzle_history (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  puzzle_id text not null,
  solved boolean not null,
  time_seconds integer,
  attempted_at timestamp with time zone default now()
);

create table public.puzzles (
  id text not null,
  fen text not null,
  moves text[] not null,
  rating integer not null,
  themes text[] default '{}'::text[] not null,
  popularity integer default 0
);

create table public.training_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid,
  result text not null,
  moves_played jsonb default '[]'::jsonb not null,
  correct_moves integer default 0,
  total_moves integer default 0,
  duration_seconds integer,
  created_at timestamp with time zone default now()
);

create table public.usage_counters (
  user_id uuid,
  day date default CURRENT_DATE not null,
  kind text not null,
  calls integer default 0 not null
);

create table public.user_position_stats (
  user_id uuid not null,
  position_key text not null,
  book_id uuid not null,
  times_visited integer default 0 not null,
  success_count integer default 0 not null,
  failure_count integer default 0 not null,
  last_visited_at timestamp with time zone
);

alter table public.access_codes add constraint access_codes_pkey PRIMARY KEY (code_hash);

alter table public.access_codes add constraint access_codes_purpose_check CHECK ((purpose = ANY (ARRAY['invite'::text, 'reset'::text])));

alter table public.access_codes add constraint access_codes_reset_has_user CHECK (((purpose <> 'reset'::text) OR (user_id IS NOT NULL)));

alter table public.drill_attempts add constraint drill_attempts_pkey PRIMARY KEY (id);

alter table public.drills add constraint drills_pkey PRIMARY KEY (id);

alter table public.opening_books add constraint opening_books_color_check CHECK ((color = ANY (ARRAY['white'::text, 'black'::text])));

alter table public.opening_books add constraint opening_books_pkey PRIMARY KEY (id);

alter table public.position_cache add constraint position_cache_pkey PRIMARY KEY (position_key);

alter table public.position_evals add constraint position_evals_pkey PRIMARY KEY (position_key, depth);

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_username_key UNIQUE (username);

alter table public.puzzle_history add constraint puzzle_history_pkey PRIMARY KEY (id);

alter table public.puzzle_history add constraint puzzle_history_user_id_puzzle_id_key UNIQUE (user_id, puzzle_id);

alter table public.puzzles add constraint puzzles_pkey PRIMARY KEY (id);

alter table public.training_sessions add constraint training_sessions_pkey PRIMARY KEY (id);

alter table public.training_sessions add constraint training_sessions_result_check CHECK ((result = ANY (ARRAY['pass'::text, 'fail'::text, 'abandoned'::text])));

alter table public.usage_counters add constraint usage_counters_key UNIQUE NULLS NOT DISTINCT (user_id, day, kind);

alter table public.user_position_stats add constraint user_position_stats_pkey PRIMARY KEY (user_id, position_key, book_id);

alter table public.access_codes add constraint access_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.drill_attempts add constraint drill_attempts_drill_id_fkey FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE;

alter table public.drill_attempts add constraint drill_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.drills add constraint drills_book_id_fkey FOREIGN KEY (book_id) REFERENCES opening_books(id) ON DELETE CASCADE;

alter table public.drills add constraint drills_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.opening_books add constraint opening_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.puzzle_history add constraint puzzle_history_puzzle_id_fkey FOREIGN KEY (puzzle_id) REFERENCES puzzles(id);

alter table public.puzzle_history add constraint puzzle_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.training_sessions add constraint training_sessions_book_id_fkey FOREIGN KEY (book_id) REFERENCES opening_books(id) ON DELETE SET NULL;

alter table public.training_sessions add constraint training_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.usage_counters add constraint usage_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.user_position_stats add constraint user_position_stats_book_id_fkey FOREIGN KEY (book_id) REFERENCES opening_books(id) ON DELETE CASCADE;

alter table public.user_position_stats add constraint user_position_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_drill_attempts_drill ON public.drill_attempts USING btree (drill_id, user_id);

CREATE INDEX idx_drills_difficulty ON public.drills USING btree (user_id, difficulty_score);

CREATE INDEX idx_drills_user_book ON public.drills USING btree (user_id, book_id);

CREATE INDEX position_cache_cached_at_idx ON public.position_cache USING btree (cached_at);

CREATE INDEX idx_ups_user_book ON public.user_position_stats USING btree (user_id, book_id);

alter table public.access_codes enable row level security;

alter table public.drill_attempts enable row level security;

alter table public.drills enable row level security;

alter table public.opening_books enable row level security;

alter table public.position_cache enable row level security;

alter table public.position_evals enable row level security;

alter table public.profiles enable row level security;

alter table public.puzzle_history enable row level security;

alter table public.puzzles enable row level security;

alter table public.training_sessions enable row level security;

alter table public.usage_counters enable row level security;

alter table public.user_position_stats enable row level security;

create policy "Users manage own drill attempts" on public.drill_attempts as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "Users manage own drills" on public.drills as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "own books" on public.opening_books as permissive for all to public
  using ((auth.uid() = user_id));

create policy "read public books" on public.opening_books as permissive for select to public
  using ((is_public = true));

create policy "read cache" on public.position_cache as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "Authenticated users read evals" on public.position_evals as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "own profile" on public.profiles as permissive for all to public
  using ((auth.uid() = id));

create policy "own puzzle history" on public.puzzle_history as permissive for all to public
  using ((auth.uid() = user_id));

create policy "read puzzles" on public.puzzles as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "own sessions" on public.training_sessions as permissive for all to public
  using ((auth.uid() = user_id));

create policy "Users manage own position stats" on public.user_position_stats as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$function$
;
-- privileges: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

CREATE OR REPLACE FUNCTION public.increment_usage(p_kind text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  insert into public.usage_counters (user_id, day, kind, calls)
  values (p_user_id, current_date, p_kind, 1)
  on conflict on constraint usage_counters_key
  do update set calls = public.usage_counters.calls + 1
  returning calls;
$function$
;
revoke execute on function public.increment_usage(text, uuid) from public, anon, authenticated;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Every table grants all privileges to anon, authenticated and service_role (Supabase's
-- defaults); row level security above is what limits them.

-- At the snapshot: 3 books, all with an object in move_node, the longest name 13 characters;
-- no rows in drills, training_sessions or user_position_stats.
