import { Injectable } from '@angular/core';
import { GolfLogService } from '../golf-log/golf-log.service';

export type FantasyPlayerType = 'hitter' | 'pitcher';

export interface FantasyPlayer {
  id: string;
  name: string;
  type: FantasyPlayerType;
  ranking: number;
}

export interface FantasyLineupSlot {
  team: string;
  slot: string;
  playerId: string | null;
}

export interface FantasySeasonStats {
  playerId: string;
  season: number;
  playedMlb: boolean;
  age: number | null;
  woba: number | null;
  xwoba: number | null;
  ba: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  hr: number | null;
  sb: number | null;
  rbi: number | null;
  runs: number | null;
  bbPercent: number | null;
  kPercent: number | null;
  era: number | null;
  xera: number | null;
  inningsPitched: number | null;
  kPer9: number | null;
  kMinusBbPercent: number | null;
}

interface FantasyPlayerRow {
  id: string;
  name: string;
  player_type: FantasyPlayerType;
  ranking_order: number;
}

interface FantasyLineupRow {
  team: string;
  slot: string;
  player_id: string | null;
}

interface FantasySeasonRow {
  player_id: string;
  season: number;
  played_mlb: boolean;
  age: number | null;
  woba: number | null;
  xwoba: number | null;
  ba: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  hr: number | null;
  sb: number | null;
  rbi: number | null;
  runs: number | null;
  bb_percent: number | null;
  k_percent: number | null;
  era: number | null;
  xera: number | null;
  innings_pitched: number | null;
  k_per_9: number | null;
  k_minus_bb_percent: number | null;
}

@Injectable({ providedIn: 'root' })
export class FantasyBaseballService {
  constructor(private readonly golfLog: GolfLogService) {}

  async isOwner(): Promise<boolean> {
    const { data, error } = await (await this.golfLog.getClient()).rpc('is_fantasy_baseball_owner');
    if (error) {
      throw error;
    }
    return data === true;
  }

  async getPlayers(): Promise<FantasyPlayer[]> {
    const { data, error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_players')
      .select('id, name, player_type, ranking_order')
      .order('ranking_order')
      .order('name');
    if (error) {
      throw error;
    }
    return (data as FantasyPlayerRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.player_type,
      ranking: row.ranking_order
    }));
  }

  async getLineups(): Promise<FantasyLineupSlot[]> {
    const { data, error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_lineups')
      .select('team, slot, player_id');
    if (error) {
      throw error;
    }
    return (data as FantasyLineupRow[]).map((row) => ({
      team: row.team,
      slot: row.slot,
      playerId: row.player_id
    }));
  }

  async getPlayerSeasons(playerId: string): Promise<FantasySeasonStats[]> {
    const { data, error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_player_seasons')
      .select('player_id, season, played_mlb, age, woba, xwoba, ba, obp, slg, ops, hr, sb, rbi, runs, bb_percent, k_percent, era, xera, innings_pitched, k_per_9, k_minus_bb_percent')
      .eq('player_id', playerId)
      .order('season', { ascending: false });
    if (error) {
      throw error;
    }
    return (data as FantasySeasonRow[]).map((row) => ({
      playerId: row.player_id,
      season: row.season,
      playedMlb: row.played_mlb,
      age: row.age,
      woba: row.woba,
      xwoba: row.xwoba,
      ba: row.ba,
      obp: row.obp,
      slg: row.slg,
      ops: row.ops,
      hr: row.hr,
      sb: row.sb,
      rbi: row.rbi,
      runs: row.runs,
      bbPercent: row.bb_percent,
      kPercent: row.k_percent,
      era: row.era,
      xera: row.xera,
      inningsPitched: row.innings_pitched,
      kPer9: row.k_per_9,
      kMinusBbPercent: row.k_minus_bb_percent
    }));
  }

  async addPlayer(name: string, type: FantasyPlayerType, ranking: number): Promise<FantasyPlayer> {
    const { data, error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_players')
      .insert({ name, player_type: type, ranking_order: ranking })
      .select('id, name, player_type, ranking_order')
      .single();
    if (error) {
      throw error;
    }
    const row = data as FantasyPlayerRow;
    return { id: row.id, name: row.name, type: row.player_type, ranking: row.ranking_order };
  }

  async updatePlayerType(playerId: string, type: FantasyPlayerType): Promise<void> {
    const { error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_players')
      .update({ player_type: type })
      .eq('id', playerId);
    if (error) {
      throw error;
    }
  }

  async saveLineupSlot(team: string, slot: string, playerId: string | null): Promise<void> {
    const { error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_lineups')
      .upsert({ team, slot, player_id: playerId }, { onConflict: 'team,slot' });
    if (error) {
      throw error;
    }
  }

  async savePlayerSeason(stats: FantasySeasonStats): Promise<void> {
    const { error } = await (await this.golfLog.getClient())
      .from('fantasy_baseball_player_seasons')
      .upsert({
        player_id: stats.playerId,
        season: stats.season,
        played_mlb: stats.playedMlb,
        age: stats.age,
        woba: stats.woba,
        xwoba: stats.xwoba,
        ba: stats.ba,
        obp: stats.obp,
        slg: stats.slg,
        ops: stats.ops,
        hr: stats.hr,
        sb: stats.sb,
        rbi: stats.rbi,
        runs: stats.runs,
        bb_percent: stats.bbPercent,
        k_percent: stats.kPercent,
        era: stats.era,
        xera: stats.xera,
        innings_pitched: stats.inningsPitched,
        k_per_9: stats.kPer9,
        k_minus_bb_percent: stats.kMinusBbPercent
      }, { onConflict: 'player_id,season' });
    if (error) {
      throw error;
    }
  }

  async saveRankings(playerIds: string[]): Promise<void> {
    const client = await this.golfLog.getClient();
    for (const [index, id] of playerIds.entries()) {
      const { error } = await client
        .from('fantasy_baseball_players')
        .update({ ranking_order: index + 1 })
        .eq('id', id);
      if (error) {
        throw error;
      }
    }
  }
}
