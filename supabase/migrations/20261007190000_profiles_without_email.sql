-- A profile's username is shown to other people later (the Bookstore's publisher names), so it
-- must never be an email. handle_new_user used to copy the account's email into it.

-- A new account's profile takes the username chosen at sign-up (the user metadata
-- `createConfirmedUser` sets). When none was given, or it is taken, the profile gets
-- "player-" and the start of the account id. The search path is pinned, as a security
-- definer function needs.
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
     or exists (select 1 from public.profiles where username = wanted) then
    wanted := fallback;
  end if;
  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Existing profiles that still hold an email take the account's chosen username when it is
-- free, and the fallback otherwise.
update public.profiles p
set username = coalesce(
      (select nullif(trim(u.raw_user_meta_data ->> 'username'), '')
       from auth.users u
       where u.id = p.id
         and nullif(trim(u.raw_user_meta_data ->> 'username'), '') not like '%@%'
         and not exists (
           select 1 from public.profiles other
           where other.username = trim(u.raw_user_meta_data ->> 'username') and other.id <> p.id)),
      'player-' || left(p.id::text, 8)),
    updated_at = now()
where p.username like '%@%';
