alter table public.golf_rounds
  add column if not exists player_name text not null default 'You';

alter table public.golf_rounds
  drop constraint if exists golf_rounds_player_name_check;

alter table public.golf_rounds
  add constraint golf_rounds_player_name_check
  check (length(trim(player_name)) between 1 and 80);
