-- The Bookstore's tables (plans/bookstore.md, Phase 3: D8, D13, D14, D17, D21, D22, D23).
-- Users may change every column of their own books and profile (the "own books" and "own
-- profile" policies), so nothing a user mustn't set lives there: who is verified, a store book's
-- totals and its reviews have tables of their own, which only the service role writes, through
-- the functions below, after a route has taken the user from the session.

-- Publishers the user has verified (D13), one at a time, from the SQL editor. The verified mark
-- is keyed on the account's id, never its username.
create table public.verified_publishers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  verified_at timestamptz not null default now()
);

-- Every book may have a description (D23), and a publisher may set a difficulty (D17). The
-- owner sets both, like the name.
alter table public.opening_books
  add column description text check (char_length(description) <= 200),
  add column publisher_difficulty numeric(2, 1) check (publisher_difficulty between 0 and 5);

-- A published book: its row in opening_books stays the publisher's, and this row puts it in the
-- store with the numbers the cards show (D8). Coverage is worked out when it is published (D11).
-- The rating and save totals are kept here so no card adds them up on request (Notes).
create table public.store_books (
  book_id uuid primary key references public.opening_books (id) on delete cascade,
  published_at timestamptz not null default now(),
  coverage real check (coverage between 0 and 1),
  rating_sum integer not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  save_count integer not null default 0 check (save_count >= 0)
);

-- The store's cards, most saved first (D14 reads at most 200).
create index store_books_saves_idx on public.store_books (save_count desc, published_at desc);

-- A review is a rating with an optional text of at most 200 characters, one per account and
-- book (D22). It is written from a saved copy in the Library, never from the store's page (D22,
-- as amended). The user hides one from the SQL editor by setting hidden; its rating still
-- counts.
create table public.book_reviews (
  book_id uuid not null references public.store_books (book_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  body text check (char_length(body) between 1 and 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- A store book's reviews, newest first, a capped page at a time.
create index book_reviews_book_newest_idx on public.book_reviews (book_id, created_at desc);

-- Which accounts have saved which store book, so a save counts once per account (D14).
create table public.book_saves (
  book_id uuid not null references public.store_books (book_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

alter table public.verified_publishers enable row level security;
alter table public.store_books enable row level security;
alter table public.book_reviews enable row level security;
alter table public.book_saves enable row level security;

-- Anyone, guests too, reads who is verified, the store's rows and the reviews not hidden (D14);
-- a writer also reads their own review when it is hidden. Owners read their own saves. No
-- policy writes.
create policy "read verified publishers" on public.verified_publishers for select to anon, authenticated
  using (true);
create policy "read store books" on public.store_books for select to anon, authenticated
  using (true);
create policy "read reviews" on public.book_reviews for select to anon, authenticated
  using (not hidden or (select auth.uid()) = user_id);
create policy "read own saves" on public.book_saves for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes or replaces p_user's review of p_book and keeps the book's totals with it. Returns
-- 'saved', 'no_book' when p_book isn't in the store, or 'no_copy' when p_user has no saved copy
-- of it (D22, as amended). The route checks the text (D25) before calling.
create function public.review_book(p_user_id uuid, p_book_id uuid, p_stars smallint, p_body text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_stars smallint;
begin
  -- The store row's lock keeps two reviews of one book from losing each other's totals.
  perform 1 from public.store_books where book_id = p_book_id for update;
  if not found then
    return 'no_book';
  end if;
  if not exists (
    select 1 from public.opening_books
    where user_id = p_user_id and origin ->> 'kind' = 'store' and origin ->> 'sourceId' = p_book_id::text
  ) then
    return 'no_copy';
  end if;
  select stars into old_stars from public.book_reviews where book_id = p_book_id and user_id = p_user_id;
  insert into public.book_reviews (book_id, user_id, stars, body)
  values (p_book_id, p_user_id, p_stars, nullif(p_body, ''))
  on conflict (book_id, user_id) do update
    set stars = excluded.stars, body = excluded.body, updated_at = now();
  update public.store_books
  set rating_sum = rating_sum + p_stars - coalesce(old_stars, 0),
      rating_count = rating_count + case when old_stars is null then 1 else 0 end
  where book_id = p_book_id;
  return 'saved';
end;
$$;

-- Deletes p_user's review of p_book and takes its rating out of the totals. Returns true when
-- there was one.
create function public.delete_review(p_user_id uuid, p_book_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  old_stars smallint;
begin
  perform 1 from public.store_books where book_id = p_book_id for update;
  delete from public.book_reviews where book_id = p_book_id and user_id = p_user_id
  returning stars into old_stars;
  if old_stars is null then
    return false;
  end if;
  update public.store_books
  set rating_sum = rating_sum - old_stars, rating_count = rating_count - 1
  where book_id = p_book_id;
  return true;
end;
$$;

-- Counts p_user's save of p_book, once per account. Returns true when this save was counted.
create function public.count_book_save(p_user_id uuid, p_book_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.book_saves (book_id, user_id)
  select p_book_id, p_user_id
  where exists (select 1 from public.store_books where book_id = p_book_id)
  on conflict (book_id, user_id) do nothing;
  if not found then
    return false;
  end if;
  update public.store_books set save_count = save_count + 1 where book_id = p_book_id;
  return true;
end;
$$;

revoke execute on function public.review_book(uuid, uuid, smallint, text) from public, anon, authenticated;
revoke execute on function public.delete_review(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.count_book_save(uuid, uuid) from public, anon, authenticated;

-- The publishing account is the first verified publisher (D13). It is found by its username,
-- which no one else can hold (usernames are unique, ignoring case).
insert into public.verified_publishers (user_id)
select id from public.profiles where lower(username) = 'bythebook'
on conflict (user_id) do nothing;
