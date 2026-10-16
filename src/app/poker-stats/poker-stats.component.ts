import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { GolfLogService } from '../golf-log/golf-log.service';
import { PokerStatsService } from './poker-stats.service';
import type { PokerSession } from './poker-stats.service';

@Component({
  selector: 'app-poker-stats',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="poker-stats">
      <a class="back-link" routerLink="/">Back to Pages</a>
      <div class="poker-heading">
        <div>
          <h1>Poker Stats</h1>
          <p class="intro">A private record of live tournament poker results.</p>
        </div>
        @if (isOwner) {
          <button type="button" class="secondary-button" [disabled]="busy" (click)="signOut()">
            Sign out
          </button>
        }
      </div>

      @if (error) {
        <p class="log-status error" role="alert">{{ error }}</p>
      }
      @if (notice) {
        <p class="log-status" role="status">{{ notice }}</p>
      }

      @if (!session) {
        <section class="admin-panel" aria-labelledby="poker-sign-in-heading">
          <h2 id="poker-sign-in-heading">Sign in</h2>
          <p class="poker-access-copy">Sign in with the Supabase account authorized for Poker Stats.</p>
          <form class="admin-form sign-in-form" (ngSubmit)="signIn()">
            <div class="form-grid">
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autocomplete="username"
                  required
                  [(ngModel)]="email"
                >
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  [(ngModel)]="password"
                >
              </label>
            </div>
            <button type="submit" [disabled]="busy">Sign in</button>
          </form>
        </section>
      } @else if (checkingAccess || loading) {
        <p class="log-status" role="status">Loading private Poker Stats…</p>
      } @else if (!isOwner) {
        <section class="admin-panel">
          <h2>Private page</h2>
          <p class="poker-access-copy">
            This account is not authorized to view Poker Stats.
          </p>
        </section>
      } @else {
        <section class="poker-summary" aria-label="Poker summary">
          <article class="poker-stat-card">
            <span>Sessions</span>
            <strong>{{ sessions.length }}</strong>
          </article>
          <article class="poker-stat-card" [class.negative]="totalNet < 0" [class.positive]="totalNet > 0">
            <span>Total net</span>
            <strong>{{ formatAmount(totalNet) }}</strong>
          </article>
          <article class="poker-stat-card">
            <span>Winning sessions</span>
            <strong>{{ winningSessions }}</strong>
          </article>
          <article class="poker-stat-card" [class.positive]="bestSession !== null && bestSession.net > 0">
            <span>Best result</span>
            <strong>{{ bestSession ? formatAmount(bestSession.net) : '—' }}</strong>
          </article>
        </section>

        <section class="admin-panel poker-entry-panel" aria-labelledby="poker-entry-heading">
          <h2 id="poker-entry-heading">Add a tournament session</h2>
          <form class="admin-form" (ngSubmit)="addSession()">
            <div class="form-grid">
              <label>
                Date
                <input name="sessionDate" type="date" required [(ngModel)]="date">
              </label>
              <label>
                Venue
                <input name="venue" type="text" maxlength="160" required [(ngModel)]="venue">
              </label>
              <label>
                Buy-ins
                <input name="buyIns" type="number" min="0" step="0.01" [(ngModel)]="buyIns">
              </label>
              <label>
                Winnings
                <input name="winnings" type="number" min="0" step="0.01" [(ngModel)]="winnings">
              </label>
              <label>
                Net result
                <input name="net" type="number" step="0.01" required [(ngModel)]="net">
              </label>
              <label>
                Notes
                <input name="notes" type="text" maxlength="1000" [(ngModel)]="notes">
              </label>
            </div>
            <button type="submit" [disabled]="busy">
              {{ busy ? 'Saving…' : 'Add session' }}
            </button>
          </form>
        </section>

        <section class="poker-history" aria-labelledby="poker-history-heading">
          <h2 id="poker-history-heading">Tournament history</h2>
          @if (sessions.length === 0) {
            <p class="log-status">No poker sessions have been recorded yet.</p>
          } @else {
            <div class="stats-table-wrap">
              <table class="stats-table poker-history-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Venue</th>
                    <th scope="col">Buy-ins</th>
                    <th scope="col">Winnings</th>
                    <th scope="col">Net</th>
                    <th scope="col">Notes</th>
                    <th scope="col"><span class="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (session of sessions; track session.id) {
                    <tr>
                      <td>{{ formatDate(session.date) }}</td>
                      <td>{{ session.venue }}</td>
                      <td>{{ formatOptionalAmount(session.buyIns) }}</td>
                      <td>{{ formatOptionalAmount(session.winnings) }}</td>
                      <td class="poker-net" [class.negative]="session.net < 0" [class.positive]="session.net > 0">
                        {{ formatAmount(session.net) }}
                      </td>
                      <td>{{ session.notes || '—' }}</td>
                      <td>
                        <button
                          type="button"
                          class="poker-delete-button"
                          [disabled]="busy"
                          [attr.aria-label]="'Delete session at ' + session.venue + ' on ' + session.date"
                          (click)="deleteSession(session)"
                        >Delete</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </main>
  `
})
export class PokerStatsComponent implements OnInit, OnDestroy {
  sessions: PokerSession[] = [];
  session: Session | null = null;
  email = '';
  password = '';
  date = this.localDate();
  venue = '';
  buyIns: number | null = null;
  winnings: number | null = null;
  net: number | null = null;
  notes = '';
  isOwner = false;
  checkingAccess = true;
  loading = true;
  busy = false;
  error = '';
  notice = '';

  private unsubscribeAuth?: () => void;

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly pokerStats: PokerStatsService
  ) {}

  get totalNet(): number {
    return this.sessions.reduce((total, item) => total + item.net, 0);
  }

  get winningSessions(): number {
    return this.sessions.filter((item) => item.net > 0).length;
  }

  get bestSession(): PokerSession | null {
    return this.sessions.reduce<PokerSession | null>(
      (best, item) => best === null || item.net > best.net ? item : best,
      null
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      this.session = await this.golfLog.getSession();
      this.unsubscribeAuth = await this.golfLog.onAuthStateChange((session) => {
        this.session = session;
        void this.refreshAccess();
      });
      await this.refreshAccess();
    } catch (error) {
      console.error('Unable to initialize Poker Stats.', error);
      this.error = this.describeError(error);
      this.checkingAccess = false;
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
  }

  async signIn(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.golfLog.signIn(this.email.trim(), this.password);
      this.password = '';
      this.session = await this.golfLog.getSession();
      await this.refreshAccess();
      this.notice = this.isOwner
        ? 'Signed in successfully.'
        : 'This account is not authorized to view Poker Stats.';
    } catch (error) {
      console.error('Unable to sign in to Poker Stats.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async signOut(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.golfLog.signOut();
      this.session = null;
      this.isOwner = false;
      this.sessions = [];
      this.notice = 'You have been signed out.';
    } catch (error) {
      console.error('Unable to sign out of Poker Stats.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async addSession(): Promise<void> {
    const parsedBuyIns = this.buyIns;
    const parsedWinnings = this.winnings;
    const parsedNet = this.net;
    if (
      (parsedBuyIns !== null && (!Number.isFinite(parsedBuyIns) || parsedBuyIns < 0)) ||
      (parsedWinnings !== null && (!Number.isFinite(parsedWinnings) || parsedWinnings < 0)) ||
      parsedNet === null ||
      !Number.isFinite(parsedNet)
    ) {
      this.error = 'Enter valid numeric values for buy-ins, winnings, and net result.';
      return;
    }

    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.pokerStats.addSession({
        date: this.date,
        venue: this.venue.trim(),
        buyIns: parsedBuyIns,
        winnings: parsedWinnings,
        net: parsedNet,
        notes: this.notes.trim() || null
      });
      await this.refreshSessions();
      this.venue = '';
      this.buyIns = null;
      this.winnings = null;
      this.net = null;
      this.notes = '';
      this.notice = 'Poker session added.';
    } catch (error) {
      console.error('Unable to add poker session.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async deleteSession(session: PokerSession): Promise<void> {
    if (!window.confirm(`Delete the poker session at ${session.venue} on ${session.date}?`)) {
      return;
    }
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.pokerStats.deleteSession(session.id);
      this.sessions = this.sessions.filter((item) => item.id !== session.id);
      this.notice = 'Poker session deleted.';
    } catch (error) {
      console.error('Unable to delete poker session.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatOptionalAmount(amount: number | null): string {
    return amount === null ? '—' : this.formatAmount(amount);
  }

  formatDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString();
  }

  private async refreshAccess(): Promise<void> {
    this.error = '';
    this.isOwner = false;
    this.sessions = [];
    this.checkingAccess = true;
    this.loading = true;
    if (!this.session) {
      this.isOwner = false;
      this.sessions = [];
      this.checkingAccess = false;
      this.loading = false;
      return;
    }

    try {
      this.isOwner = await this.pokerStats.isOwner();
      if (this.isOwner) {
        await this.refreshSessions();
      } else {
        this.sessions = [];
      }
    } catch (error) {
      console.error('Unable to verify Poker Stats access.', error);
      this.error = this.describeError(error);
    } finally {
      this.checkingAccess = false;
      this.loading = false;
    }
  }

  private async refreshSessions(): Promise<void> {
    this.sessions = await this.pokerStats.getSessions();
  }

  private localDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
  }
}
