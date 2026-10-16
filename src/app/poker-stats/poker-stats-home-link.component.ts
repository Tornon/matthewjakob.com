import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { GolfLogService } from '../golf-log/golf-log.service';
import { PokerStatsService } from './poker-stats.service';

@Component({
  selector: 'app-poker-stats-home-link',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (canViewPoker) {
      <a class="page-card poker-page-card" routerLink="/poker-stats">
        <span class="page-card-label">Private</span>
        <h3>Poker Stats</h3>
        <p>A private record of live tournament poker results.</p>
      </a>
    }
    @if (accessError) {
      <p class="log-status error" role="alert">{{ accessError }}</p>
    }
  `
})
export class PokerStatsHomeLinkComponent implements OnInit, OnDestroy {
  canViewPoker = false;
  accessError = '';
  private unsubscribeAuth?: () => void;

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly pokerStats: PokerStatsService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.refreshAccess(await this.golfLog.getSession());
      this.unsubscribeAuth = await this.golfLog.onAuthStateChange((session) => {
        void this.refreshAccess(session);
      });
    } catch (error) {
      console.error('Unable to check private Poker Stats access.', error);
      this.accessError = 'Private Poker Stats access could not be checked.';
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
  }

  private async refreshAccess(session: Session | null): Promise<void> {
    this.accessError = '';
    this.canViewPoker = false;
    if (!session) {
      return;
    }
    try {
      this.canViewPoker = await this.pokerStats.isOwner();
    } catch (error) {
      console.error('Unable to check private Poker Stats access.', error);
      this.accessError = 'Private Poker Stats access could not be checked.';
    }
  }
}
