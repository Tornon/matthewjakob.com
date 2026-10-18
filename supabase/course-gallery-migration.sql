create table if not exists public.golf_course_gallery (
  id uuid primary key default gen_random_uuid(),
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  image_path text not null unique,
  caption text check (caption is null or length(caption) <= 240),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'golf-course-images',
  'golf-course-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists golf_course_gallery_course_created_idx
  on public.golf_course_gallery (course_name, created_at, id);

alter table public.golf_course_gallery enable row level security;

revoke all on public.golf_course_gallery from anon, public;
grant select on public.golf_course_gallery to anon, authenticated;
grant insert, delete on public.golf_course_gallery to authenticated;

drop policy if exists "Golf course gallery is publicly readable" on public.golf_course_gallery;
drop policy if exists "Golf log admins can add course gallery photos" on public.golf_course_gallery;
drop policy if exists "Golf log admins can remove course gallery photos" on public.golf_course_gallery;

create policy "Golf course gallery is publicly readable"
  on public.golf_course_gallery
  for select
  to anon, authenticated
  using (true);

create policy "Golf log admins can add course gallery photos"
  on public.golf_course_gallery
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can remove course gallery photos"
  on public.golf_course_gallery
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));
