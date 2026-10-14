create function public.valid_golf_course_pars(pars integer[])
returns boolean
language sql
immutable
strict
as $$
  select cardinality(pars) in (9, 18)
    and array_position(pars, null::integer) is null
    and not exists (
      select 1
      from unnest(pars) as hole(par)
      where par not between 3 and 6
    );
$$;

create table public.golf_courses (
  name text primary key check (length(trim(name)) between 1 and 160),
  pars integer[] not null check (public.valid_golf_course_pars(pars))
);

alter table public.golf_rounds
  add column starting_hole smallint not null default 1;

alter table public.golf_rounds
  add constraint golf_rounds_starting_hole_check
  check (starting_hole in (1, 10) and (starting_hole = 1 or cardinality(hole_strokes) = 9));

alter table public.golf_rounds
  drop constraint if exists golf_rounds_played_on_course_total_strokes_hole_strokes_key;

alter table public.golf_rounds
  add constraint golf_rounds_round_identity_key
  unique (played_on, course, starting_hole, total_strokes, hole_strokes);

alter table public.golf_courses enable row level security;
grant select on public.golf_courses to anon, authenticated;
grant insert, update on public.golf_courses to authenticated;

create policy "Golf courses are publicly readable"
  on public.golf_courses
  for select
  to anon, authenticated
  using (true);

create policy "Golf log admins can add courses"
  on public.golf_courses
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can edit courses"
  on public.golf_courses
  for update
  to authenticated
  using ((select public.is_golf_log_admin()))
  with check ((select public.is_golf_log_admin()));
