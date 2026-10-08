-- Migration B (plans/deployment.md, Phase 5 and D28): every book now lives in `trees` with
-- its `summary`, so both become required and `move_node` goes. Run it only once the code that
-- no longer reads or writes `move_node` is deployed: the code before it writes the column on
-- every save. It changes nothing when a book still lacks its trees or summary.
do $$
begin
  if exists (select 1 from public.opening_books where trees is null or summary is null) then
    raise exception 'Some books have no trees or summary yet, so nothing was changed.';
  end if;
end
$$;

alter table public.opening_books
  alter column trees set not null,
  alter column summary set not null,
  add constraint opening_books_trees_is_list check (jsonb_typeof(trees) = 'array'),
  add constraint opening_books_summary_is_object check (jsonb_typeof(summary) = 'object'),
  drop column move_node;
