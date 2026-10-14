create table if not exists public.golf_course_notes (
  id uuid primary key default gen_random_uuid(),
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  hole_number smallint check (hole_number between 1 and 18),
  note text not null check (length(trim(note)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists golf_course_notes_course_hole_idx
  on public.golf_course_notes (course_name, hole_number, created_at);

create table if not exists public.golf_course_ratings (
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (course_name, user_id)
);

create table if not exists public.golf_course_holes (
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  hole_number smallint not null check (hole_number between 1 and 18),
  image_path text not null,
  updated_at timestamptz not null default now(),
  primary key (course_name, hole_number)
);

alter table public.golf_course_notes enable row level security;
alter table public.golf_course_ratings enable row level security;
alter table public.golf_course_holes enable row level security;

grant select on public.golf_course_notes to anon, authenticated;
grant insert, delete on public.golf_course_notes to authenticated;
grant select on public.golf_course_ratings to authenticated;
grant insert, update on public.golf_course_ratings to authenticated;
grant select on public.golf_course_holes to anon, authenticated;
grant insert, update, delete on public.golf_course_holes to authenticated;

drop policy if exists "Golf course notes are publicly readable" on public.golf_course_notes;
create policy "Golf course notes are publicly readable"
  on public.golf_course_notes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Golf log admins can add course notes" on public.golf_course_notes;
create policy "Golf log admins can add course notes"
  on public.golf_course_notes
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

drop policy if exists "Golf log admins can remove course notes" on public.golf_course_notes;
create policy "Golf log admins can remove course notes"
  on public.golf_course_notes
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));

drop policy if exists "Golf admins can read their own course ratings" on public.golf_course_ratings;
create policy "Golf admins can read their own course ratings"
  on public.golf_course_ratings
  for select
  to authenticated
  using ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

drop policy if exists "Golf admins can add their own course ratings" on public.golf_course_ratings;
create policy "Golf admins can add their own course ratings"
  on public.golf_course_ratings
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

drop policy if exists "Golf admins can update their own course ratings" on public.golf_course_ratings;
create policy "Golf admins can update their own course ratings"
  on public.golf_course_ratings
  for update
  to authenticated
  using ((select public.is_golf_log_admin()) and user_id = (select auth.uid()))
  with check ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

drop policy if exists "Golf course hole photos are publicly readable" on public.golf_course_holes;
create policy "Golf course hole photos are publicly readable"
  on public.golf_course_holes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Golf log admins can add course hole photos" on public.golf_course_holes;
create policy "Golf log admins can add course hole photos"
  on public.golf_course_holes
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

drop policy if exists "Golf log admins can update course hole photos" on public.golf_course_holes;
create policy "Golf log admins can update course hole photos"
  on public.golf_course_holes
  for update
  to authenticated
  using ((select public.is_golf_log_admin()))
  with check ((select public.is_golf_log_admin()));

drop policy if exists "Golf log admins can remove course hole photos" on public.golf_course_holes;
create policy "Golf log admins can remove course hole photos"
  on public.golf_course_holes
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));

create or replace function public.get_golf_course_rating_summary(p_course_name text)
returns table (total_ratings bigint, average_rating numeric, my_rating integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::bigint,
    coalesce(avg(rating)::numeric, 0),
    coalesce(
      (max(rating) filter (where user_id = (select auth.uid())))::integer,
      0
    )
  from public.golf_course_ratings
  where course_name = p_course_name;
$$;

revoke all on function public.get_golf_course_rating_summary(text) from public;
grant execute on function public.get_golf_course_rating_summary(text) to anon, authenticated;
