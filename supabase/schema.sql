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
  tee_time_url text,
  scorecard_path text,
  background_image_path text,
  background_image_opacity real not null default 0.12
    check (background_image_opacity between 0.03 and 0.5),
  background_image_position_x real not null default 50
    check (background_image_position_x between 0 and 100),
  background_image_position_y real not null default 50
    check (background_image_position_y between 0 and 100)
);

create table public.golf_course_notes (
  id uuid primary key default gen_random_uuid(),
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  hole_number smallint check (hole_number between 1 and 18),
  note text not null check (length(trim(note)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index golf_course_notes_course_hole_idx
  on public.golf_course_notes (course_name, hole_number, created_at);

create table public.golf_course_ratings (
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (course_name, user_id)
);

create table public.golf_course_holes (
  course_name text not null check (length(trim(course_name)) between 1 and 160),
  hole_number smallint not null check (hole_number between 1 and 18),
  image_path text not null,
  updated_at timestamptz not null default now(),
  primary key (course_name, hole_number)
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

create table public.poker_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  played_on date not null,
  venue text not null check (length(trim(venue)) between 1 and 160),
  buy_ins numeric(12, 2) check (buy_ins is null or buy_ins >= 0),
  winnings numeric(12, 2) check (winnings is null or winnings >= 0),
  net numeric(12, 2) not null,
  notes text check (notes is null or length(notes) <= 1000),
  import_key text,
  created_at timestamptz not null default now(),
  unique (user_id, import_key)
);

create table public.fantasy_baseball_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  player_type text not null check (player_type in ('hitter', 'pitcher')),
  ranking_order integer not null default 0 check (ranking_order > 0),
  created_at timestamptz not null default now()
);

create table public.fantasy_baseball_lineups (
  team text not null check (team in (
    'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CWS', 'CIN', 'CLE', 'COL', 'DET',
    'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'ATH',
    'PHI', 'PIT', 'SD', 'SF', 'SEA', 'STL', 'TB', 'TEX', 'TOR', 'WSH'
  )),
  slot text not null check (slot in (
    '1B', '2B', '3B', 'SS', 'OF1', 'OF2', 'OF3', 'DH',
    'SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'CL', 'RP'
  )),
  player_id uuid references public.fantasy_baseball_players (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team, slot)
);

create table public.fantasy_baseball_player_seasons (
  player_id uuid not null references public.fantasy_baseball_players (id) on delete cascade,
  season smallint not null check (season between 1900 and 2200),
  played_mlb boolean not null default false,
  age numeric(4, 1) check (age is null or age between 0 and 100),
  woba numeric(7, 4) check (woba is null or woba between 0 and 2),
  xwoba numeric(7, 4) check (xwoba is null or xwoba between 0 and 2),
  ba numeric(7, 4) check (ba is null or ba between 0 and 1),
  obp numeric(7, 4) check (obp is null or obp between 0 and 1),
  slg numeric(7, 4) check (slg is null or slg between 0 and 5),
  ops numeric(7, 4) check (ops is null or ops between 0 and 5),
  hr integer check (hr is null or hr >= 0),
  sb integer check (sb is null or sb >= 0),
  rbi integer check (rbi is null or rbi >= 0),
  runs integer check (runs is null or runs >= 0),
  bb_percent numeric(6, 2) check (bb_percent is null or bb_percent between 0 and 100),
  k_percent numeric(6, 2) check (k_percent is null or k_percent between 0 and 100),
  era numeric(7, 3) check (era is null or era >= 0),
  xera numeric(7, 3) check (xera is null or xera >= 0),
  innings_pitched numeric(8, 1) check (innings_pitched is null or innings_pitched >= 0),
  k_per_9 numeric(7, 3) check (k_per_9 is null or k_per_9 >= 0),
  k_minus_bb_percent numeric(6, 2) check (k_minus_bb_percent is null or k_minus_bb_percent between -100 and 100),
  updated_at timestamptz not null default now(),
  primary key (player_id, season)
);

create index golf_rounds_played_on_idx
  on public.golf_rounds (played_on desc, created_at desc);
create index poker_sessions_played_on_idx
  on public.poker_sessions (played_on desc, created_at desc);
create unique index fantasy_baseball_players_name_lower_idx
  on public.fantasy_baseball_players (lower(name));
create index fantasy_baseball_players_ranking_idx
  on public.fantasy_baseball_players (ranking_order, name);
create unique index fantasy_baseball_lineups_player_idx
  on public.fantasy_baseball_lineups (player_id)
  where player_id is not null;
create index fantasy_baseball_player_seasons_season_idx
  on public.fantasy_baseball_player_seasons (season desc, player_id);

alter table public.golf_log_admins enable row level security;
alter table public.golf_courses enable row level security;
alter table public.golf_course_notes enable row level security;
alter table public.golf_course_ratings enable row level security;
alter table public.golf_course_holes enable row level security;
alter table public.golf_rounds enable row level security;
alter table public.poker_sessions enable row level security;
alter table public.fantasy_baseball_players enable row level security;
alter table public.fantasy_baseball_lineups enable row level security;
alter table public.fantasy_baseball_player_seasons enable row level security;
revoke all on public.poker_sessions from anon, public;
revoke all on public.fantasy_baseball_players from anon, public;
revoke all on public.fantasy_baseball_lineups from anon, public;
revoke all on public.fantasy_baseball_player_seasons from anon, public;
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

create function public.is_poker_stats_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) = 'bcc7a172-3a63-404c-a0f1-af26786ffd96'::uuid;
$$;

create function public.is_fantasy_baseball_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) = 'bcc7a172-3a63-404c-a0f1-af26786ffd96'::uuid;
$$;

revoke all on function public.is_golf_log_admin() from public;
grant execute on function public.is_golf_log_admin() to anon, authenticated;
revoke all on function public.is_poker_stats_owner() from public;
grant execute on function public.is_poker_stats_owner() to authenticated;
revoke all on function public.is_fantasy_baseball_owner() from public;
grant execute on function public.is_fantasy_baseball_owner() to authenticated;

grant select on public.golf_rounds to anon, authenticated;
grant insert, update, delete on public.golf_rounds to authenticated;
grant select, insert, delete on public.poker_sessions to authenticated;
grant select on public.fantasy_baseball_players to anon, authenticated;
grant insert, update on public.fantasy_baseball_players to authenticated;
grant select on public.fantasy_baseball_lineups to anon, authenticated;
grant insert, update on public.fantasy_baseball_lineups to authenticated;
grant select on public.fantasy_baseball_player_seasons to anon, authenticated;
grant insert, update on public.fantasy_baseball_player_seasons to authenticated;
grant select on public.golf_courses to anon, authenticated;
grant insert, update on public.golf_courses to authenticated;
grant select on public.golf_course_notes to anon, authenticated;
grant insert, delete on public.golf_course_notes to authenticated;
grant select on public.golf_course_ratings to authenticated;
grant insert, update on public.golf_course_ratings to authenticated;
grant select on public.golf_course_holes to anon, authenticated;
grant insert, update, delete on public.golf_course_holes to authenticated;

create policy "Golf course notes are publicly readable"
  on public.golf_course_notes
  for select
  to anon, authenticated
  using (true);

create policy "Golf log admins can add course notes"
  on public.golf_course_notes
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can remove course notes"
  on public.golf_course_notes
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));

create policy "Golf admins can read their own course ratings"
  on public.golf_course_ratings
  for select
  to authenticated
  using ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

create policy "Golf admins can add their own course ratings"
  on public.golf_course_ratings
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

create policy "Golf admins can update their own course ratings"
  on public.golf_course_ratings
  for update
  to authenticated
  using ((select public.is_golf_log_admin()) and user_id = (select auth.uid()))
  with check ((select public.is_golf_log_admin()) and user_id = (select auth.uid()));

create policy "Golf course hole photos are publicly readable"
  on public.golf_course_holes
  for select
  to anon, authenticated
  using (true);

create policy "Golf log admins can add course hole photos"
  on public.golf_course_holes
  for insert
  to authenticated
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can update course hole photos"
  on public.golf_course_holes
  for update
  to authenticated
  using ((select public.is_golf_log_admin()))
  with check ((select public.is_golf_log_admin()));

create policy "Golf log admins can remove course hole photos"
  on public.golf_course_holes
  for delete
  to authenticated
  using ((select public.is_golf_log_admin()));

create function public.get_golf_course_rating_summary(p_course_name text)
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
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
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

create policy "Poker stats owner can read sessions"
  on public.poker_sessions
  for select
  to authenticated
  using ((select public.is_poker_stats_owner()) and user_id = (select auth.uid()));

create policy "Poker stats owner can add sessions"
  on public.poker_sessions
  for insert
  to authenticated
  with check ((select public.is_poker_stats_owner()) and user_id = (select auth.uid()));

create policy "Poker stats owner can remove sessions"
  on public.poker_sessions
  for delete
  to authenticated
  using ((select public.is_poker_stats_owner()) and user_id = (select auth.uid()));

create policy "Fantasy baseball players are publicly readable"
  on public.fantasy_baseball_players
  for select
  to anon, authenticated
  using (true);

create policy "Fantasy baseball owner can add players"
  on public.fantasy_baseball_players
  for insert
  to authenticated
  with check ((select public.is_fantasy_baseball_owner()));

create policy "Fantasy baseball owner can edit players"
  on public.fantasy_baseball_players
  for update
  to authenticated
  using ((select public.is_fantasy_baseball_owner()))
  with check ((select public.is_fantasy_baseball_owner()));

create policy "Fantasy baseball lineups are publicly readable"
  on public.fantasy_baseball_lineups
  for select
  to anon, authenticated
  using (true);

create policy "Fantasy baseball owner can edit lineups"
  on public.fantasy_baseball_lineups
  for all
  to authenticated
  using ((select public.is_fantasy_baseball_owner()))
  with check ((select public.is_fantasy_baseball_owner()));

create policy "Fantasy baseball player stats are publicly readable"
  on public.fantasy_baseball_player_seasons
  for select
  to anon, authenticated
  using (true);

create policy "Fantasy baseball owner can edit player stats"
  on public.fantasy_baseball_player_seasons
  for all
  to authenticated
  using ((select public.is_fantasy_baseball_owner()))
  with check ((select public.is_fantasy_baseball_owner()));
