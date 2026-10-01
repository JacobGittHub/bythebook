-- One-time codes for the beta (plans/deployment.md, D6 and D14). An invite code lets its
-- holder create an account. A reset code lets the owner of one account set a new password.
-- Only a code's SHA-256 hash is stored; the code itself is printed once by
-- `npm run invites:create`.
create table public.access_codes (
  code_hash text primary key,
  purpose text not null check (purpose in ('invite', 'reset')),
  -- A reset code: the account it resets. An invite code: the account it created, once used.
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Null until the code is used. A code is used by setting this where it is still null.
  claimed_at timestamptz,
  constraint access_codes_reset_has_user check (purpose <> 'reset' or user_id is not null)
);

-- No policies: only the service role, on the server, reads or writes this table.
alter table public.access_codes enable row level security;
