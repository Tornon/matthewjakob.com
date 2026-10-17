create table if not exists public.fantasy_baseball_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  player_type text not null check (player_type in ('hitter', 'pitcher')),
  ranking_order integer not null default 0 check (ranking_order > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists fantasy_baseball_players_name_lower_idx
  on public.fantasy_baseball_players (lower(name));
create index if not exists fantasy_baseball_players_ranking_idx
  on public.fantasy_baseball_players (ranking_order, name);

create table if not exists public.fantasy_baseball_lineups (
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

create unique index if not exists fantasy_baseball_lineups_player_idx
  on public.fantasy_baseball_lineups (player_id)
  where player_id is not null;

create table if not exists public.fantasy_baseball_player_seasons (
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

create index if not exists fantasy_baseball_player_seasons_season_idx
  on public.fantasy_baseball_player_seasons (season desc, player_id);

alter table public.fantasy_baseball_players enable row level security;
alter table public.fantasy_baseball_lineups enable row level security;
alter table public.fantasy_baseball_player_seasons enable row level security;

revoke all on public.fantasy_baseball_players from anon, public;
revoke all on public.fantasy_baseball_lineups from anon, public;
revoke all on public.fantasy_baseball_player_seasons from anon, public;
grant select on public.fantasy_baseball_players to anon, authenticated;
grant insert, update on public.fantasy_baseball_players to authenticated;
grant select on public.fantasy_baseball_lineups to anon, authenticated;
grant insert, update on public.fantasy_baseball_lineups to authenticated;
grant select on public.fantasy_baseball_player_seasons to anon, authenticated;
grant insert, update on public.fantasy_baseball_player_seasons to authenticated;

create or replace function public.is_fantasy_baseball_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) = 'bcc7a172-3a63-404c-a0f1-af26786ffd96'::uuid;
$$;

revoke all on function public.is_fantasy_baseball_owner() from public;
grant execute on function public.is_fantasy_baseball_owner() to authenticated;

drop policy if exists "Fantasy baseball players are publicly readable" on public.fantasy_baseball_players;
drop policy if exists "Fantasy baseball owner can add players" on public.fantasy_baseball_players;
drop policy if exists "Fantasy baseball owner can edit players" on public.fantasy_baseball_players;
drop policy if exists "Fantasy baseball lineups are publicly readable" on public.fantasy_baseball_lineups;
drop policy if exists "Fantasy baseball owner can edit lineups" on public.fantasy_baseball_lineups;
drop policy if exists "Fantasy baseball player stats are publicly readable" on public.fantasy_baseball_player_seasons;
drop policy if exists "Fantasy baseball owner can edit player stats" on public.fantasy_baseball_player_seasons;

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
