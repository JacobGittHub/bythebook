-- Usernames are unique without regard to case, so "Alice" can't pass for "alice"
-- (plans/bookstore.md, D8 and Q3). Run after 20261007190000_profiles_without_email.sql.
-- If two existing profiles differ only in case, the index fails to build and nothing changes;
-- rename one of them and run this again.
create unique index profiles_username_lower_key on public.profiles (lower(username));
alter table public.profiles drop constraint profiles_username_key;

-- The sign-up trigger checks for a taken name the same way.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  fallback text := 'player-' || left(new.id::text, 8);
begin
  if wanted is null or wanted like '%@%'
     or exists (select 1 from public.profiles where lower(username) = lower(wanted)) then
    wanted := fallback;
  end if;
  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
