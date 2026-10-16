alter table public.golf_courses
  add column if not exists scorecard_path text;

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
