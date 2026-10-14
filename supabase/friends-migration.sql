create or replace function public.valid_golf_friend_scores(scores jsonb, expected_holes integer)
returns boolean
language sql
immutable
strict
as $$
  select case
    when jsonb_typeof(scores) <> 'array' then false
    when expected_holes not in (9, 18) then false
    else not exists (
      select 1
      from jsonb_array_elements(scores) as friend(entry)
      where case
        when jsonb_typeof(entry) is distinct from 'object' then true
        when jsonb_typeof(entry->'name') is distinct from 'string' then true
        when length(trim(entry->>'name')) = 0 then true
        when jsonb_typeof(entry->'holes') is distinct from 'array' then true
        when jsonb_array_length(entry->'holes') <> expected_holes then true
        else exists (
          select 1
          from jsonb_array_elements(entry->'holes') as hole(strokes)
          where case jsonb_typeof(strokes)
            when 'null' then false
            when 'number' then
              (strokes #>> '{}')::numeric < 1
              or (strokes #>> '{}')::numeric <> trunc((strokes #>> '{}')::numeric)
            else true
          end
        )
      end
    )
  end;
$$;

alter table public.golf_rounds
  add column if not exists friend_scores jsonb not null default '[]'::jsonb;

alter table public.golf_rounds
  drop constraint if exists golf_rounds_friend_scores_check;

alter table public.golf_rounds
  add constraint golf_rounds_friend_scores_check
  check (public.valid_golf_friend_scores(friend_scores, cardinality(hole_strokes)));
