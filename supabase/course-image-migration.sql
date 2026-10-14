alter table public.golf_courses
  add column if not exists background_image_path text,
  add column if not exists background_image_opacity real not null default 0.12;

alter table public.golf_courses
  drop constraint if exists golf_courses_background_image_opacity_check;

alter table public.golf_courses
  add constraint golf_courses_background_image_opacity_check
  check (background_image_opacity between 0.03 and 0.5);

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

drop policy if exists "Golf course images are publicly readable" on storage.objects;
create policy "Golf course images are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'golf-course-images');

drop policy if exists "Golf log admins can upload course images" on storage.objects;
create policy "Golf log admins can upload course images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));

drop policy if exists "Golf log admins can update course images" on storage.objects;
create policy "Golf log admins can update course images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()))
  with check (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));

drop policy if exists "Golf log admins can delete course images" on storage.objects;
create policy "Golf log admins can delete course images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'golf-course-images' and (select public.is_golf_log_admin()));
