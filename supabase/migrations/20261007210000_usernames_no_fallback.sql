-- A new account never gets a made-up username. The sign-up trigger refuses a name that is
-- missing, breaks the rules (src/lib/validators/schemas.ts, USERNAME_PATTERN) or is taken,
-- so the account isn't created and the sign-up page asks for another name. Existing
-- profiles, including any "player-" names the 20261007190000 update gave, are unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := trim(new.raw_user_meta_data ->> 'username');
begin
  if wanted is null or wanted !~ '^[A-Za-z0-9_-]{3,24}$' then
    raise exception 'A new account needs a username of 3 to 24 letters, digits, _ or -.'
      using errcode = 'check_violation';
  end if;
  -- A taken name fails on profiles_username_lower_key.
  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
