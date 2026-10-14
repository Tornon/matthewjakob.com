import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import {
  GolfLogService,
  parseGolfImportData,
  type GolfRound,
  type ImportedGolfRound
} from './golf-log.service';

@Component({
  selector: 'app-golf-log',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="golf-log">
      <a class="back-link" routerLink="/">&larr; Back to home</a>
      <h1>Golf Log</h1>
      <p class="intro">A place to keep track of rounds played with friends.</p>

      @if (loading) {
        <p class="log-status" role="status">Loading rounds...</p>
      } @else if (loadError) {
        <p class="log-status error" role="alert">{{ loadError }}</p>
      } @else if (rounds.length === 0) {
        <section class="empty-state" aria-labelledby="empty-heading">
          <h2 id="empty-heading">No rounds yet</h2>
          <p>The golf log is getting ready for its first round.</p>
        </section>
      } @else {
        <p class="public-score-notice">
          Friend names and scores shown here are public.
        </p>
        <label class="course-filter">
          Filter rounds by course
          <select name="courseFilter" [(ngModel)]="selectedCourse">
            <option value="">All courses ({{ rounds.length }})</option>
            @for (courseName of courses; track courseName) {
              <option [value]="courseName">{{ courseName }} ({{ countRoundsAt(courseName) }})</option>
            }
          </select>
        </label>

        @if (filteredRounds.length === 0) {
          <p class="log-status">No rounds at this course yet.</p>
        } @else {
          <ol class="round-list" aria-label="Golf rounds">
            @for (round of filteredRounds; track round.id) {
              <li class="round-card">
                <div class="round-heading">
                  <div>
                    <h2>{{ round.course }}</h2>
                    <time [attr.datetime]="round.date">{{ formatDate(round.date) }}</time>
                  </div>
                  <div class="round-result">
                    <p class="round-score"><strong>{{ round.score }}</strong><span>strokes</span></p>
                    @if (canManage) {
                      <button
                        type="button"
                        class="secondary-button"
                        [disabled]="busy"
                        (click)="startEditing(round)"
                      >
                        Edit
                      </button>
                    }
                  </div>
                </div>

                <details>
                  <summary>Scorecards ({{ round.friends.length + 1 }} players)</summary>
                  <div class="scorecard-scroll">
                    <table class="scorecard">
                      <caption>{{ round.course }} - {{ formatDate(round.date) }}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Player</th>
                          @for (hole of round.holes; track $index) {
                            <th scope="col">{{ $index + 1 }}</th>
                          }
                          <th scope="col">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">{{ round.playerName }}</th>
                          @for (strokes of round.holes; track $index) {
                            <td>{{ strokes ?? '-' }}</td>
                          }
                          <td>{{ round.score }}</td>
                        </tr>
                        @for (friend of round.friends; track $index) {
                          <tr>
                            <th scope="row">{{ friend.name }}</th>
                            @for (strokes of friend.holes; track $index) {
                              <td>{{ strokes ?? '-' }}</td>
                            }
                            <td>
                              {{ recordedStrokes(friend.holes) }}@if (hasUnrecordedHoles(friend.holes)) { * }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  @if (hasFriendWithUnrecordedHoles(round)) {
                    <p class="scorecard-note">* Friend totals include recorded holes only.</p>
                  }
                </details>
              </li>
            }
          </ol>
        }
      }

      @if (authError) {
        <p class="log-status error" role="alert">{{ authError }}</p>
      }
      @if (notice) {
        <p class="log-status" role="status">{{ notice }}</p>
      }

      <section class="admin-panel" aria-labelledby="admin-heading">
        <h2 id="admin-heading">Manage rounds</h2>
        @if (!session) {
          <form class="admin-form sign-in-form" (ngSubmit)="signIn()">
            <div class="form-grid">
              <label>
                Admin email
                <input
                  id="admin-email"
                  name="adminEmail"
                  type="email"
                  autocomplete="username"
                  required
                  [(ngModel)]="adminEmail"
                >
              </label>
              <label>
                Password
                <input
                  name="adminPassword"
                  type="password"
                  autocomplete="current-password"
                  required
                  [(ngModel)]="adminPassword"
                >
              </label>
            </div>
            <button type="submit" [disabled]="busy">Sign in</button>
          </form>
        } @else if (canManage) {
          <div class="admin-actions">
            <button type="button" class="secondary-button" [disabled]="busy" (click)="signOut()">
              Sign out
            </button>
          </div>

          <form id="round-editor" class="admin-form" (ngSubmit)="addRound()">
            <h3>{{ editRoundId ? 'Edit round' : 'Add a round' }}</h3>
            <div class="form-grid">
              <label>
                Date
                <input name="roundDate" type="date" required [(ngModel)]="roundDate">
              </label>
              <label>
                Course
                <input
                  name="course"
                  type="text"
                  list="played-courses"
                  maxlength="160"
                  autocomplete="off"
                  required
                  [(ngModel)]="course"
                >
                <datalist id="played-courses">
                  @for (courseName of courses; track courseName) {
                    <option [value]="courseName"></option>
                  }
                </datalist>
              </label>
              <label class="wide-field">
                Scorecards (one player per line: Name | hole scores separated by commas)
                <textarea
                  name="playerScorecards"
                  rows="6"
                  required
                  placeholder="Your name | 4, 5, 3, 4, 6, 4, 5, 4, 3&#10;Alex | 4, 5, 3, 4, 6, 4, 5, 4, 3"
                  [(ngModel)]="playerScorecards"
                ></textarea>
              </label>
            </div>
            <p class="form-help">
              Your name and scorecard go on the first line. Add friends on following lines.
              Use 9 or 18 hole scores and - for an unrecorded hole. Totals are calculated from
              recorded scores. Player names and scores will be public.
            </p>
            <div class="form-actions">
              <button type="submit" [disabled]="busy">
                @if (busy) {
                  Saving...
                } @else {
                  {{ editRoundId ? 'Save changes' : 'Add round' }}
                }
              </button>
              @if (editRoundId) {
                <button
                  type="button"
                  class="secondary-button"
                  [disabled]="busy"
                  (click)="cancelEditing()"
                >
                  Cancel
                </button>
              }
            </div>
          </form>

          <section class="admin-form import-form">
            <h3>Import rounds</h3>
            <p>
              Select your original 18Birdies JSON export or a sanitized golf rounds JSON file.
              Only names and round scorecards are uploaded; account and social data stay private.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              [disabled]="busy"
              (change)="importRounds($event)"
            >
          </section>
        } @else {
          <p class="log-status">
            Signed in, but this account is not authorized to manage rounds.
          </p>
          <button type="button" class="secondary-button" [disabled]="busy" (click)="signOut()">
            Sign out
          </button>
        }
      </section>
    </main>
  `
})
export class GolfLogComponent implements OnInit, OnDestroy {
  rounds: GolfRound[] = [];
  loading = true;
  busy = false;
  loadError = '';
  authError = '';
  notice = '';
  adminEmail = '';
  adminPassword = '';
  selectedCourse = '';
  roundDate = '';
  course = '';
  playerScorecards = '';
  session: Session | null = null;
  canManage = false;
  editRoundId: string | null = null;

  private unsubscribeAuth?: () => void;

  get courses(): string[] {
    return [...new Set(this.rounds.map((round) => round.course))]
      .sort((left, right) => left.localeCompare(right));
  }

  get filteredRounds(): GolfRound[] {
    return this.selectedCourse
      ? this.rounds.filter((round) => round.course === this.selectedCourse)
      : this.rounds;
  }

  constructor(private readonly golfLog: GolfLogService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.unsubscribeAuth = await this.golfLog.onAuthStateChange((session) => {
        void this.updateSession(session);
      });
      await this.refreshRounds();
      await this.updateSession(await this.golfLog.getSession());
    } catch (error) {
      console.error('Unable to initialize golf log.', error);
      this.loadError = this.describeError(error);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
  }

  async signIn(): Promise<void> {
    this.busy = true;
    this.authError = '';
    this.notice = '';
    try {
      await this.golfLog.signIn(this.adminEmail.trim(), this.adminPassword);
      this.adminPassword = '';
      await this.updateSession(await this.golfLog.getSession());
      if (this.canManage) {
        this.notice = 'Signed in successfully.';
      } else if (!this.authError) {
        this.notice = 'Signed in, but this account is not authorized to manage rounds.';
      }
    } catch (error) {
      console.error('Unable to sign in to the golf log.', error);
      this.authError = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async signOut(): Promise<void> {
    this.busy = true;
    this.authError = '';
    try {
      await this.golfLog.signOut();
      this.notice = 'You have been signed out.';
    } catch (error) {
      console.error('Unable to sign out of the golf log.', error);
      this.authError = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async addRound(): Promise<void> {
    this.busy = true;
    this.authError = '';
    this.notice = '';
    try {
      const round = this.createRoundFromForm();
      if (this.editRoundId) {
        await this.golfLog.updateRound(this.editRoundId, round);
      } else {
        await this.golfLog.addRound(round);
      }
      this.cancelEditing();
      this.selectedCourse = '';
      const refreshed = await this.refreshRounds();
      this.notice = refreshed
        ? 'Round saved successfully.'
        : 'Round saved successfully, but the round list could not be refreshed. Reload the page to see it.';
    } catch (error) {
      console.error('Unable to add golf round.', error);
      this.authError = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async importRounds(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.busy = true;
    this.authError = '';
    this.notice = '';
    try {
      const source: unknown = JSON.parse(await file.text());
      const { rounds, skippedWithoutScores } = parseGolfImportData(source);
      if (rounds.length === 0) {
        throw new Error(
          skippedWithoutScores
            ? `Found ${skippedWithoutScores} rounds, but none had recorded hole scores to import.`
            : 'The selected JSON file does not contain any golf rounds.'
        );
      }

      const inserted = await this.golfLog.importRounds(rounds);
      this.notice =
        `Imported ${inserted} new rounds. ` +
        `${skippedWithoutScores} rounds with no recorded hole scores were skipped; ` +
        'exact duplicates were also skipped.';
      await this.refreshRounds();
    } catch (error) {
      console.error('Unable to import golf rounds.', error);
      this.authError = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
  }

  countRoundsAt(courseName: string): number {
    return this.rounds.filter((round) => round.course === courseName).length;
  }

  recordedStrokes(holes: (number | null)[]): number {
    return holes.reduce<number>((total, strokes) => total + (strokes ?? 0), 0);
  }

  hasUnrecordedHoles(holes: (number | null)[]): boolean {
    return holes.some((strokes) => strokes === null);
  }

  friendHasUnrecordedHoles(friend: { holes: (number | null)[] }): boolean {
    return this.hasUnrecordedHoles(friend.holes);
  }

  hasFriendWithUnrecordedHoles(round: GolfRound): boolean {
    return round.friends.some((friend) => this.friendHasUnrecordedHoles(friend));
  }

  startEditing(round: GolfRound): void {
    this.editRoundId = round.id;
    this.roundDate = round.date;
    this.course = round.course;
    this.playerScorecards = [
      `${round.playerName} | ${round.holes.map((strokes) => strokes ?? '-').join(', ')}`,
      ...round.friends.map(
        (friend) => `${friend.name} | ${friend.holes.map((strokes) => strokes ?? '-').join(', ')}`
      )
    ].join('\n');
    this.notice = `Editing ${round.course} (${this.formatDate(round.date)}). Update the form below and save.`;
    this.authError = '';
    document.getElementById('round-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  cancelEditing(): void {
    this.editRoundId = null;
    this.roundDate = '';
    this.course = '';
    this.playerScorecards = '';
  }

  private async updateSession(session: Session | null): Promise<void> {
    this.session = session;
    this.canManage = false;
    this.authError = '';
    if (!session) {
      this.cancelEditing();
      return;
    }

    try {
      this.canManage = await this.golfLog.isAdmin();
      if (!this.canManage) {
        this.cancelEditing();
      }
    } catch (error) {
      console.error('Unable to check golf log admin access.', error);
      this.authError = this.describeError(error);
    }
  }

  private async refreshRounds(): Promise<boolean> {
    this.loading = true;
    this.loadError = '';
    try {
      this.rounds = await this.golfLog.getRounds();
      return true;
    } catch (error) {
      console.error('Unable to load golf rounds.', error);
      this.loadError = this.describeError(error);
      return false;
    } finally {
      this.loading = false;
    }
  }

  private createRoundFromForm(): ImportedGolfRound {
    const date = new Date(`${this.roundDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(this.roundDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== this.roundDate
    ) {
      throw new Error('Enter a valid round date.');
    }

    if (!this.course.trim()) {
      throw new Error('Enter a course name.');
    }

    const scorecards = this.parseScorecards();
    const player = scorecards[0];
    const score = this.recordedStrokes(player.holes);
    if (score < 1) {
      throw new Error('Enter at least one recorded hole score for your scorecard.');
    }

    return {
      date: this.roundDate,
      course: this.course.trim(),
      playerName: player.name,
      score,
      holes: player.holes,
      friends: scorecards.slice(1).map(({ name, holes }) => ({ name, holes }))
    };
  }

  private parseScorecards(): { name: string; holes: (number | null)[] }[] {
    const lines = this.playerScorecards.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      throw new Error('Enter your scorecard on the first line.');
    }

    const seenNames = new Set<string>();
    let holeCount: number | null = null;

    return lines.map((line, index) => {
      const separator = line.indexOf('|');
      if (separator < 1 || line.indexOf('|', separator + 1) !== -1) {
        throw new Error(`Scorecard line ${index + 1} must use the format Name | hole scores.`);
      }

      const name = line.slice(0, separator).trim();
      if (!name || name.length > 80) {
        throw new Error(`Player name on line ${index + 1} must be between 1 and 80 characters.`);
      }

      const normalizedName = name.toLocaleLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new Error(`Player "${name}" is listed more than once.`);
      }
      seenNames.add(normalizedName);

      const tokens = line.slice(separator + 1).split(',').map((token) => token.trim());
      if (![9, 18].includes(tokens.length)) {
        throw new Error(`${name}'s scorecard must have exactly 9 or 18 hole scores.`);
      }
      if (holeCount !== null && tokens.length !== holeCount) {
        throw new Error(
          `All scorecards must have the same number of holes as ${lines[0].split('|')[0].trim()}.`
        );
      }
      holeCount = tokens.length;

      const holes = tokens.map((token) => {
        if (token === '-') {
          return null;
        }
        const strokes = Number(token);
        if (!Number.isInteger(strokes) || strokes < 1) {
          throw new Error(`${name}'s scores must be positive whole numbers or - for unrecorded holes.`);
        }
        return strokes;
      });

      return { name, holes };
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}
