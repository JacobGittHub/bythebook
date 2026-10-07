-- Books as lists of trees, with a stored summary and where they came from
-- (plans/deployment.md, Phase 5: D24, D26; plans/bookstore.md, D16). It only adds: move_node
-- stays until `npm run books:migrate` has filled the new columns and the user has checked the
-- books, and a later migration drops it (D28).
alter table public.opening_books
  add column trees jsonb,
  add column summary jsonb,
  add column origin jsonb not null default '{"kind":"own"}'::jsonb;

-- The book list reads one user's books, newest first.
create index if not exists opening_books_user_updated_idx
  on public.opening_books (user_id, updated_at desc);
