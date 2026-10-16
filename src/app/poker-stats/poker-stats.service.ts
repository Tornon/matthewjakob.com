import { Injectable } from '@angular/core';
import { GolfLogService } from '../golf-log/golf-log.service';

export interface PokerSession {
  id: string;
  date: string;
  venue: string;
  buyIns: number | null;
  winnings: number | null;
  net: number;
  notes: string | null;
}

export interface NewPokerSession {
  date: string;
  venue: string;
  buyIns: number | null;
  winnings: number | null;
  net: number;
  notes: string | null;
}

interface PokerSessionRow {
  id: string;
  played_on: string;
  venue: string;
  buy_ins: number | null;
  winnings: number | null;
  net: number;
  notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class PokerStatsService {
  constructor(private readonly golfLog: GolfLogService) {}

  async isOwner(): Promise<boolean> {
    const { data, error } = await (await this.golfLog.getClient()).rpc('is_poker_stats_owner');
    if (error) {
      throw error;
    }
    return data === true;
  }

  async getSessions(): Promise<PokerSession[]> {
    const { data, error } = await (await this.golfLog.getClient())
      .from('poker_sessions')
      .select('id, played_on, venue, buy_ins, winnings, net, notes')
      .order('played_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      throw error;
    }

    return (data as PokerSessionRow[]).map((row) => ({
      id: row.id,
      date: row.played_on,
      venue: row.venue,
      buyIns: row.buy_ins,
      winnings: row.winnings,
      net: row.net,
      notes: row.notes
    }));
  }

  async addSession(session: NewPokerSession): Promise<void> {
    const { error } = await (await this.golfLog.getClient())
      .from('poker_sessions')
      .insert({
        played_on: session.date,
        venue: session.venue,
        buy_ins: session.buyIns,
        winnings: session.winnings,
        net: session.net,
        notes: session.notes
      });
    if (error) {
      throw error;
    }
  }

  async deleteSession(id: string): Promise<void> {
    const { error } = await (await this.golfLog.getClient())
      .from('poker_sessions')
      .delete()
      .eq('id', id);
    if (error) {
      throw error;
    }
  }
}
