create function public.valid_golf_hole_strokes(scores integer[])
returns boolean
language sql
immutable
strict
as $$
  select cardinality(scores) in (9, 18)
    and not exists (
      select 1
      from unnest(scores) as hole(strokes)
      where strokes is not null and strokes <= 0
    );
$$;

create function public.valid_golf_friend_scores(scores jsonb, expected_holes integer)
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

create table public.golf_log_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.golf_courses (
  name text primary key check (length(trim(name)) between 1 and 160),
  pars integer[] not null check (public.valid_golf_course_pars(pars)),
  background_image_path text,
  background_image_opacity real not null default 0.12
    check (background_image_opacity between 0.03 and 0.5)
);

create table public.golf_rounds (
  id uuid primary key default gen_random_uuid(),
  played_on date not null,
  course text not null check (length(trim(course)) > 0),
  starting_hole smallint not null default 1,
  player_name text not null default 'You'
    check (length(trim(player_name)) between 1 and 80),
  total_strokes integer not null check (total_strokes > 0),
  hole_strokes integer[] not null check (public.valid_golf_hole_strokes(hole_strokes)),
  friend_scores jsonb not null default '[]'::jsonb
    check (public.valid_golf_friend_scores(friend_scores, cardinality(hole_strokes))),
  check (starting_hole in (1, 10) and (starting_hole = 1 or cardinality(hole_strokes) = 9)),
  created_at timestamptz not null default now(),
  unique (played_on, course, starting_hole, total_strokes, hole_strokes)
);

create index golf_rounds_played_on_idx
  on public.golf_rounds (played_on desc, created_at desc);

alter table public.golf_log_admins enable row level security;
alter table public.golf_courses enable row level security;
alter table public.golf_rounds enable row level security;
grant usage on schema public to anon, authenticated;

create function public.is_golf_log_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.golf_log_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_golf_log_admin() from public;
grant execute on function public.is_golf_log_admin() to anon, authenticated;

grant select on public.golf_rounds to anon, authenticated;
grant insert, update, delete on public.golf_rounds to authenticated;
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'golf-course-images',
  'golf-course-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Golf course images are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'golf-course-images');

create policy "Golf log admins can upload course images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));

create policy "Golf log admins can update course images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()))
  with check (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));

create policy "Golf log admins can delete course images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));

create policy "Golf rounds are publicly readable"
  on public.golf_rounds
  for select
  to anon, authenticated
  using (true);

create policy "Golf log admins can add rounds"
  on public.golf_rounds
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can edit rounds"
  on public.golf_rounds
  for update
  to authenticated
  using ((select public.is_golf_log_admin()))
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can remove rounds"
  on public.golf_rounds
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));
