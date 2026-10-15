import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import {
  courseHoleIndex,
  GolfLogService,
  parseGolfImportData,
  type GolfCourse,
  type GolfCourseRatingSummary,
  type GolfRound,
  type ImportedGolfRound
} from './golf-log.service';

interface ScorecardEntry {
  name: string;
  holes: (number | null)[];
}

@Component({
  selector: 'app-golf-log',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="golf-log">
      <a class="back-link" routerLink="/">&larr; Back to home</a>
      <div class="golf-log-heading">
        <h1>Golf Log</h1>
        @if (canManage) {
          <button
            type="button"
            class="add-round-button"
            [disabled]="busy"
            (click)="startAddingRound()"
          >Add a new round</button>
        }
      </div>
      <p class="intro">A place to keep track of rounds played with friends.</p>
      <p class="course-details-link">
        <a routerLink="/golf-courses">Course details &amp; stats</a>
      </p>

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
        <fieldset class="player-filter">
          <legend>Filter rounds by player(s)</legend>
          <label>
            <input
              type="checkbox"
              [checked]="selectedPlayers.length === 0"
              (change)="clearPlayerFilter()"
            >
            All players
          </label>
          @for (player of players; track player) {
            <label>
              <input
                type="checkbox"
                [checked]="selectedPlayers.includes(player)"
                (change)="togglePlayer(player, $event)"
              >
              {{ player }}
            </label>
          }
        </fieldset>
        <div class="course-filter-row">
          <label class="course-filter">
            Filter rounds by course
            <select name="courseFilter" [(ngModel)]="selectedCourse">
              <option value="">All courses ({{ courses.length }})</option>
              @for (courseName of courses; track courseName) {
                <option [value]="courseName">
                  {{ courseName }}{{ isCourseConfigured(courseName) ? '' : ' — Setup needed' }}
                  ({{ countRoundsAt(courseName) }})
                </option>
              }
            </select>
          </label>
          @if (selectedCourseTeeTimeUrl; as teeTimeUrl) {
            <a
              class="tee-time-button"
              [href]="teeTimeUrl"
              target="_blank"
              rel="noopener noreferrer"
              [attr.aria-label]="'Book a tee time at ' + selectedCourse"
            ><span aria-hidden="true">★</span> BOOK TEE TIME</a>
          }
        </div>

        @if (filteredRounds.length === 0) {
          <p class="log-status">No rounds match these filters.</p>
        } @else {
          <ol class="round-list" aria-label="Golf rounds">
            @for (round of filteredRounds; track round.id) {
              <li class="round-card">
                @if (courseWatermark(round); as watermark) {
                  <img
                    class="round-card-watermark"
                    [src]="watermark.url"
                    [style.opacity]="watermark.opacity"
                    [style.object-position]="watermark.positionX + '% ' + watermark.positionY + '%'"
                    alt=""
                    aria-hidden="true"
                  >
                }
                <div class="round-heading">
                  <div>
                    <h2>{{ roundTitle(round) }}</h2>
                    <time [attr.datetime]="round.date">{{ formatDate(round.date) }}</time>
                    <a
                      class="round-course-notes-link"
                      routerLink="/golf-course-notes"
                      [queryParams]="{ course: round.course }"
                    >
                      <span>Notes &amp; Course Config</span>
                      <span class="round-course-rating" [attr.aria-label]="courseRatingLabel(round.course)">
                        @if (courseRatingSummary(round.course); as rating) {
                          @if (rating.totalRatings > 0) {
                            <span aria-hidden="true">★</span> {{ formatCourseRating(rating.averageRating) }}
                          } @else {
                            <span>No ratings</span>
                          }
                        } @else {
                          <span>Loading rating...</span>
                        }
                      </span>
                    </a>
                    @if (!isCourseConfigured(round.course)) {
                      <a
                        class="course-setup-badge"
                        routerLink="/golf-course-notes"
                        [queryParams]="{ course: round.course }"
                        [attr.aria-label]="'Configure pars for ' + round.course"
                      >Par setup needed <span aria-hidden="true">→</span></a>
                    }
                  </div>
                  <div class="round-result">
                    <div class="round-scores" aria-label="Player totals">
                      <span class="round-scores-label">Total strokes</span>
                      <ul>
                        @for (playerTotal of playerTotals(round); track playerTotal.name) {
                          <li>
                            <span>{{ playerTotal.name }}</span>
                            <strong>
                              {{ playerTotal.score }}@if (playerTotal.partial) { * }
                            </strong>
                          </li>
                        }
                      </ul>
                    </div>
                    @if (canManage) {
                      <button
                        type="button"
                        class="secondary-button"
                        [disabled]="busy"
                        (click)="startEditing(round)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="danger-button"
                        [disabled]="busy"
                        (click)="deleteRound(round)"
                      >
                        Delete
                      </button>
                    }
                  </div>
                </div>

                <details>
                  <summary>Scorecards ({{ round.friends.length + 1 }} players)</summary>
                  <div class="scorecard-scroll">
                    <table class="scorecard">
                      <caption>{{ roundTitle(round) }} - {{ formatDate(round.date) }}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Player</th>
                          @for (hole of round.holes; track $index) {
                            <th scope="col">{{ scorecardHoleNumber(round, $index) }}</th>
                            @if (round.holes.length === 18 && $index === 8) {
                              <th scope="col" class="scorecard-subtotal">Front 9</th>
                            }
                          }
                          @if (round.holes.length === 9) {
                            <th scope="col" class="scorecard-subtotal">Front 9</th>
                          }
                          <th scope="col" class="scorecard-subtotal">Back 9</th>
                          <th scope="col" class="scorecard-total">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="par-row">
                          <th scope="row">Par</th>
                          @for (hole of round.holes; track $index) {
                            <td>{{ parForHole(round, $index) ?? '-' }}</td>
                            @if (round.holes.length === 18 && $index === 8) {
                              <td class="scorecard-subtotal par-front-total">{{ segmentPar(round, 1) ?? '-' }}</td>
                            }
                          }
                          @if (round.holes.length === 9) {
                            <td class="scorecard-subtotal par-front-total">{{ segmentPar(round, 1) ?? '-' }}</td>
                          }
                          <td class="scorecard-subtotal par-back-total">{{ segmentPar(round, 10) ?? '-' }}</td>
                          <td class="scorecard-total par-round-total">{{ totalPar(round) ?? '-' }}</td>
                        </tr>
                        <tr>
                          <th scope="row">{{ round.playerName }}</th>
                          @for (strokes of round.holes; track $index) {
                            <td>
                              @if (strokes === null) {
                                -
                              } @else {
                                <span
                                  class="score-marker"
                                  [class.score-marker-birdie]="scoreMarker(round, $index, strokes) === 'birdie'"
                                  [class.score-marker-bogey]="scoreMarker(round, $index, strokes) === 'bogey'"
                                  [class.score-marker-double-bogey]="scoreMarker(round, $index, strokes) === 'double-bogey'"
                                  [class.score-marker-worse]="scoreMarker(round, $index, strokes) === 'worse'"
                                >{{ strokes }}</span>
                              }
                            </td>
                            @if (round.holes.length === 18 && $index === 8) {
                              <td class="scorecard-subtotal">
                                {{ segmentStrokes(round, round.holes, 1) ?? '-' }}@if (segmentHasUnrecordedHoles(round, round.holes, 1)) { * }
                              </td>
                            }
                          }
                          @if (round.holes.length === 9) {
                            <td class="scorecard-subtotal">
                              {{ segmentStrokes(round, round.holes, 1) ?? '-' }}@if (segmentHasUnrecordedHoles(round, round.holes, 1)) { * }
                            </td>
                          }
                          <td class="scorecard-subtotal">
                            {{ segmentStrokes(round, round.holes, 10) ?? '-' }}@if (segmentHasUnrecordedHoles(round, round.holes, 10)) { * }
                          </td>
                          <td class="scorecard-total">{{ round.score }}</td>
                        </tr>
                        @for (friend of round.friends; track $index) {
                          <tr>
                            <th scope="row">{{ friend.name }}</th>
                            @for (strokes of friend.holes; track $index) {
                              <td>
                                @if (strokes === null) {
                                  -
                                } @else {
                                  <span
                                    class="score-marker"
                                    [class.score-marker-birdie]="scoreMarker(round, $index, strokes) === 'birdie'"
                                    [class.score-marker-bogey]="scoreMarker(round, $index, strokes) === 'bogey'"
                                    [class.score-marker-double-bogey]="scoreMarker(round, $index, strokes) === 'double-bogey'"
                                    [class.score-marker-worse]="scoreMarker(round, $index, strokes) === 'worse'"
                                  >{{ strokes }}</span>
                                }
                              </td>
                              @if (round.holes.length === 18 && $index === 8) {
                                <td class="scorecard-subtotal">
                                  {{ segmentStrokes(round, friend.holes, 1) ?? '-' }}@if (segmentHasUnrecordedHoles(round, friend.holes, 1)) { * }
                                </td>
                              }
                            }
                            @if (round.holes.length === 9) {
                              <td class="scorecard-subtotal">
                                {{ segmentStrokes(round, friend.holes, 1) ?? '-' }}@if (segmentHasUnrecordedHoles(round, friend.holes, 1)) { * }
                              </td>
                            }
                            <td class="scorecard-subtotal">
                              {{ segmentStrokes(round, friend.holes, 10) ?? '-' }}@if (segmentHasUnrecordedHoles(round, friend.holes, 10)) { * }
                            </td>
                            <td class="scorecard-total">
                              {{ recordedStrokes(friend.holes) }}@if (hasUnrecordedHoles(friend.holes)) { * }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  @if (hasUnrecordedScorecards(round) || hasUnrecordedSegmentScores(round)) {
                    <p class="scorecard-note">* Totals and nine-hole subtotals include recorded holes only.</p>
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
              <label>
                Holes played
                <select
                  name="scorecardHoleCount"
                  [ngModel]="scorecardHoleCount"
                  (ngModelChange)="setScorecardHoleCount($event)"
                >
                  <option [ngValue]="9">9 holes</option>
                  <option [ngValue]="18">18 holes</option>
                </select>
              </label>
              @if (scorecardHoleCount === 9) {
                <label>
                  Nine-hole segment
                  <select name="startingHole" [(ngModel)]="startingHole">
                    <option [ngValue]="1">Front nine (holes 1–9)</option>
                    <option [ngValue]="10">Back nine (holes 10–18)</option>
                  </select>
                </label>
              }
              <datalist id="player-names">
                @for (playerName of players; track playerName) {
                  <option [value]="playerName"></option>
                }
              </datalist>
              <section class="scorecard-entry-list wide-field" aria-label="Player scorecards">
                @for (scorecard of scorecardPlayers; track $index; let playerIndex = $index) {
                  <fieldset class="scorecard-entry">
                    <legend>{{ playerIndex === 0 ? 'Your scorecard' : 'Player ' + (playerIndex + 1) }}</legend>
                    <div class="scorecard-entry-heading">
                      <label>
                        Player name
                        <input
                          [name]="'player-name-' + playerIndex"
                          type="text"
                          list="player-names"
                          maxlength="80"
                          autocomplete="off"
                          placeholder="Choose or enter a name"
                          [(ngModel)]="scorecard.name"
                        >
                      </label>
                      @if (playerIndex > 0) {
                        <button
                          type="button"
                          class="secondary-button"
                          [disabled]="busy"
                          (click)="removeScorecardPlayer(playerIndex)"
                        >Remove player</button>
                      }
                    </div>
                    <div class="hole-entry-grid">
                      @for (strokes of scorecard.holes; track $index; let holeIndex = $index) {
                        <label>
                          Hole {{ scoreEntryHoleNumber(holeIndex) }}
                          <input
                            [name]="'player-' + playerIndex + '-hole-' + holeIndex"
                            type="number"
                            min="1"
                            step="1"
                            inputmode="numeric"
                            [attr.aria-label]="scorecard.name + ' score for hole ' + scoreEntryHoleNumber(holeIndex)"
                            [(ngModel)]="scorecard.holes[holeIndex]"
                          >
                        </label>
                      }
                    </div>
                  </fieldset>
                }
                <button
                  type="button"
                  class="secondary-button"
                  [disabled]="busy"
                  (click)="addScorecardPlayer()"
                >Add another player</button>
              </section>
            </div>
            <p class="form-help">
              Enter any recorded scores; leave unplayed or unrecorded holes blank. Your scorecard
              is first, followed by any other players. Totals are calculated automatically.
              Player names and scores will be public.
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
  courseConfigs: GolfCourse[] = [];
  courseRatingSummaries: Record<string, GolfCourseRatingSummary> = {};
  courseRatingsLoaded = false;
  loading = true;
  busy = false;
  loadError = '';
  authError = '';
  notice = '';
  adminEmail = '';
  adminPassword = '';
  selectedPlayers: string[] = [];
  selectedCourse = '';
  startingHole: 1 | 10 = 1;
  roundDate = '';
  course = '';
  scorecardHoleCount: 9 | 18 = 18;
  scorecardPlayers: ScorecardEntry[] = [this.createEmptyScorecard()];
  session: Session | null = null;
  canManage = false;
  editRoundId: string | null = null;
  readonly scoreSegments: (1 | 10)[] = [1, 10];

  private unsubscribeAuth?: () => void;

  get courses(): string[] {
    return [...new Set([
      ...this.rounds.map((round) => round.course),
      ...this.courseConfigs.map((course) => course.name)
    ])]
      .sort((left, right) => left.localeCompare(right));
  }

  get players(): string[] {
    return [...new Set(this.rounds.flatMap((round) => [
      round.playerName,
      ...round.friends.map((friend) => friend.name)
    ]))]
      .sort((left, right) => left.localeCompare(right));
  }

  get roundsMatchingPlayers(): GolfRound[] {
    return this.rounds.filter((round) => this.matchesSelectedPlayers(round));
  }

  get filteredRounds(): GolfRound[] {
    return this.selectedCourse
      ? this.roundsMatchingPlayers.filter((round) => round.course === this.selectedCourse)
      : this.roundsMatchingPlayers;
  }

  get selectedCourseTeeTimeUrl(): string | null {
    if (!this.selectedCourse) {
      return null;
    }
    return this.courseConfigs.find(
      (course) => course.name.trim().toLocaleLowerCase() === this.selectedCourse.trim().toLocaleLowerCase()
    )?.teeTimeUrl?.trim() || null;
  }

  constructor(private readonly golfLog: GolfLogService) {}

  setScorecardHoleCount(holeCount: 9 | 18): void {
    this.scorecardHoleCount = holeCount;
    this.scorecardPlayers = this.scorecardPlayers.map((scorecard) => ({
      ...scorecard,
      holes: Array.from(
        { length: holeCount },
        (_, index) => scorecard.holes[index] ?? null
      )
    }));
    if (holeCount === 9) {
      this.startingHole = 1;
    }
  }

  addScorecardPlayer(): void {
    this.scorecardPlayers = [...this.scorecardPlayers, this.createEmptyScorecard()];
  }

  scoreEntryHoleNumber(index: number): number {
    return this.scorecardHoleCount === 9 && this.startingHole === 10
      ? index + 10
      : index + 1;
  }

  removeScorecardPlayer(index: number): void {
    if (index > 0) {
      this.scorecardPlayers = this.scorecardPlayers.filter((_, playerIndex) => playerIndex !== index);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      this.unsubscribeAuth = await this.golfLog.onAuthStateChange((session) => {
        void this.updateSession(session);
      });
      await this.refreshRounds();
      await this.refreshCourseConfigs();
      await this.refreshCourseRatingSummaries();
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
      let result: 'added' | 'merged' | 'updated' = 'added';
      if (this.editRoundId) {
        await this.golfLog.updateRound(this.editRoundId, round);
        result = 'updated';
      } else {
        result = await this.golfLog.addRound(round);
      }
      this.cancelEditing();
      this.selectedCourse = '';
      const refreshed = await this.refreshRounds();
      const successMessage = result === 'merged'
        ? 'Player scorecard added to the existing round.'
        : result === 'updated'
          ? 'Round updated successfully.'
          : 'Round added successfully.';
      this.notice = refreshed
        ? successMessage
        : `${successMessage} The round list could not be refreshed. Reload the page to see it.`;
    } catch (error) {
      console.error('Unable to add golf round.', error);
      this.authError = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async deleteRound(round: GolfRound): Promise<void> {
    const confirmation = `Delete ${this.roundTitle(round)} from ${this.formatDate(round.date)}? This cannot be undone.`;
    if (!window.confirm(confirmation)) {
      return;
    }

    this.busy = true;
    this.authError = '';
    this.notice = '';
    try {
      await this.golfLog.deleteRound(round.id);
      if (this.editRoundId === round.id) {
        this.cancelEditing();
      }
      const refreshed = await this.refreshRounds();
      this.notice = refreshed
        ? 'Round deleted successfully.'
        : 'Round deleted successfully, but the round list could not be refreshed. Reload the page to see the updated list.';
    } catch (error) {
      console.error('Unable to delete golf round.', error);
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

      const result = await this.golfLog.importRounds(rounds);
      this.notice =
        `Added ${result.added} new rounds and merged scorecards into ${result.merged} matching rounds. ` +
        `${result.combined} duplicate round entries were combined. ` +
        `${skippedWithoutScores} rounds with no recorded hole scores were skipped; ` +
        'repeat player scorecards were updated from the import.';
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
    return this.roundsMatchingPlayers.filter((round) => round.course === courseName).length;
  }

  isCourseConfigured(courseName: string): boolean {
    return this.courseConfigs.some((course) =>
      course.name.toLocaleLowerCase() === courseName.toLocaleLowerCase()
    );
  }

  courseWatermark(
    round: GolfRound
  ): { url: string; opacity: number; positionX: number; positionY: number } | null {
    const course = this.courseConfigs.find(
      (config) => config.name.toLocaleLowerCase() === round.course.toLocaleLowerCase()
    );
    return course?.backgroundImageUrl
      ? {
          url: course.backgroundImageUrl,
          opacity: course.backgroundImageOpacity ?? 0.12,
          positionX: course.backgroundImagePositionX ?? 50,
          positionY: course.backgroundImagePositionY ?? 50
        }
      : null;
  }

  courseRatingSummary(courseName: string): GolfCourseRatingSummary | null {
    return this.courseRatingSummaries[this.courseKey(courseName)] ?? (
      this.courseRatingsLoaded
        ? { totalRatings: 0, averageRating: 0, myRating: 0 }
        : null
    );
  }

  courseRatingLabel(courseName: string): string {
    const summary = this.courseRatingSummary(courseName);
    return summary?.totalRatings
      ? `${summary.averageRating.toFixed(1)} out of 5 from ${summary.totalRatings} ratings`
      : 'No course ratings yet';
  }

  formatCourseRating(rating: number): string {
    return rating.toFixed(1);
  }

  clearPlayerFilter(): void {
    this.selectedPlayers = [];
  }

  togglePlayer(player: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.selectedPlayers = input.checked
      ? [...this.selectedPlayers, player]
      : this.selectedPlayers.filter((selectedPlayer) => selectedPlayer !== player);
  }

  roundTitle(round: GolfRound): string {
    const holesPlayed = round.holes.filter((strokes) => strokes !== null).length;
    return holesPlayed === 18 ? round.course : `${round.course} (${holesPlayed} holes)`;
  }

  scorecardHoleNumber(round: GolfRound, index: number): number {
    const courseConfig = this.courseConfigs.find((course) => course.name === round.course);
    if (courseConfig?.pars.length === 9) {
      return index + 1;
    }
    return round.holes.length === 9 && round.startingHole === 10 ? index + 10 : index + 1;
  }

  parForHole(round: GolfRound, index: number): number | null {
    const course = this.courseConfigs.find((item) => item.name === round.course);
    if (!course) {
      return null;
    }

    const parIndex = courseHoleIndex(
      course.pars.length,
      round.holes,
      round.startingHole,
      index
    );
    return parIndex === null ? null : course.pars[parIndex];
  }

  totalPar(round: GolfRound): number | null {
    const pars = round.holes.map((_, index) => this.parForHole(round, index));
    return pars.length > 0 && pars.every((par) => par !== null)
      ? pars.reduce<number>((total, par) => total + (par ?? 0), 0)
      : null;
  }

  segmentPar(round: GolfRound, startingHole: 1 | 10): number | null {
    if (round.holes.length === 9 && round.startingHole !== startingHole) {
      return null;
    }

    const indexes = round.holes.length === 9
      ? round.holes.map((_, index) => index)
      : round.holes.map((_, index) => index)
        .filter((index) => index >= startingHole - 1 && index < startingHole + 8);
    const pars = indexes.map((index) => this.parForHole(round, index));
    return pars.length === 9 && pars.every((par) => par !== null)
      ? pars.reduce<number>((total, par) => total + (par ?? 0), 0)
      : null;
  }

  segmentStrokes(
    round: GolfRound,
    holes: (number | null)[],
    startingHole: 1 | 10
  ): number | null {
    if (holes.length === 9 && round.startingHole !== startingHole) {
      return null;
    }

    const segment = holes.length === 9
      ? holes
      : holes.slice(startingHole - 1, startingHole + 8);
    return segment.some((strokes) => strokes !== null)
      ? segment.reduce<number>((total, strokes) => total + (strokes ?? 0), 0)
      : null;
  }

  segmentHasUnrecordedHoles(
    round: GolfRound,
    holes: (number | null)[],
    startingHole: 1 | 10
  ): boolean {
    if (holes.length === 9 && round.startingHole !== startingHole) {
      return false;
    }

    const segment = holes.length === 9
      ? holes
      : holes.slice(startingHole - 1, startingHole + 8);
    return segment.some((strokes) => strokes === null);
  }

  hasUnrecordedSegmentScores(round: GolfRound): boolean {
    return [
      round.holes,
      ...round.friends.map((friend) => friend.holes)
    ].some((holes) =>
      this.scoreSegments.some((segment) =>
        this.segmentHasUnrecordedHoles(round, holes, segment)
      )
    );
  }

  scoreMarker(
    round: GolfRound,
    index: number,
    strokes: number
  ): 'birdie' | 'bogey' | 'double-bogey' | 'worse' | null {
    const par = this.parForHole(round, index);
    if (par === null || strokes === par) {
      return null;
    }
    if (strokes < par) {
      return 'birdie';
    }
    if (strokes === par + 1) {
      return 'bogey';
    }
    return strokes === par + 2 ? 'double-bogey' : 'worse';
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

  hasUnrecordedScorecards(round: GolfRound): boolean {
    return this.hasUnrecordedHoles(round.holes) || this.hasFriendWithUnrecordedHoles(round);
  }

  playerTotals(round: GolfRound): { name: string; score: number; partial: boolean }[] {
    return [
      {
        name: round.playerName,
        score: round.score,
        partial: this.hasUnrecordedHoles(round.holes)
      },
      ...round.friends.map((friend) => ({
        name: friend.name,
        score: this.recordedStrokes(friend.holes),
        partial: this.hasUnrecordedHoles(friend.holes)
      }))
    ].sort((left, right) =>
      left.score - right.score || left.name.localeCompare(right.name)
    );
  }

  private matchesSelectedPlayers(round: GolfRound): boolean {
    if (this.selectedPlayers.length === 0) {
      return true;
    }

    const roundPlayers = new Set([
      round.playerName,
      ...round.friends.map((friend) => friend.name)
    ].map((name) => name.toLocaleLowerCase()));

    return this.selectedPlayers.every((player) => roundPlayers.has(player.toLocaleLowerCase()));
  }

  startEditing(round: GolfRound): void {
    this.editRoundId = round.id;
    this.roundDate = round.date;
    this.course = round.course;
    this.startingHole = round.startingHole;
    this.scorecardHoleCount = round.holes.length === 9 ? 9 : 18;
    this.scorecardPlayers = [
      { name: round.playerName, holes: [...round.holes] },
      ...round.friends.map((friend) => ({ name: friend.name, holes: [...friend.holes] }))
    ];
    this.notice = `Editing ${round.course} (${this.formatDate(round.date)}). Update the form below and save.`;
    this.authError = '';
    document.getElementById('round-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  startAddingRound(): void {
    this.cancelEditing();
    this.authError = '';
    this.notice = '';
    document.getElementById('round-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  cancelEditing(): void {
    this.editRoundId = null;
    this.roundDate = '';
    this.course = '';
    this.startingHole = 1;
    this.scorecardHoleCount = 18;
    this.scorecardPlayers = [this.createEmptyScorecard()];
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

  private async refreshCourseConfigs(): Promise<void> {
    try {
      this.courseConfigs = await this.golfLog.getCourseConfigs();
    } catch (error) {
      console.error('Unable to load golf course configurations.', error);
      this.loadError = this.describeError(error);
    }
  }

  private async refreshCourseRatingSummaries(): Promise<void> {
    const courseNames = [...new Map(
      this.rounds.map((round) => [this.courseKey(round.course), round.course])
    ).values()];

    try {
      const summaries = await Promise.all(courseNames.map(async (courseName) => ({
        key: this.courseKey(courseName),
        summary: await this.golfLog.getCourseRatingSummary(courseName)
      })));
      this.courseRatingSummaries = Object.fromEntries(
        summaries.map(({ key, summary }) => [key, summary])
      );
    } catch (error) {
      console.error('Unable to load course rating summaries.', error);
      this.loadError = this.describeError(error);
    } finally {
      this.courseRatingsLoaded = true;
    }
  }

  private courseKey(courseName: string): string {
    return courseName.trim().toLocaleLowerCase();
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
      friends: scorecards.slice(1).map(({ name, holes }) => ({ name, holes })),
      startingHole: player.holes.length === 9 ? this.startingHole : 1
    };
  }

  private parseScorecards(): { name: string; holes: (number | null)[] }[] {
    if (!this.scorecardPlayers[0]?.name.trim()) {
      throw new Error('Enter your name on the first scorecard.');
    }
    const entries = this.scorecardPlayers
      .map(({ name, holes }) => ({ name: name.trim(), holes }))
      .filter(({ name, holes }) => name || holes.some((strokes) => strokes !== null));
    const seenNames = new Set<string>();
    return entries.map(({ name, holes }, index) => {
      if (!name || name.length > 80) {
        throw new Error(`Enter a player name between 1 and 80 characters for scorecard ${index + 1}.`);
      }

      const normalizedName = name.toLocaleLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new Error(`Player "${name}" is listed more than once.`);
      }
      seenNames.add(normalizedName);

      if (holes.length !== this.scorecardHoleCount) {
        throw new Error(`${name}'s scorecard does not match the selected hole count.`);
      }
      const validatedHoles = holes.map((strokes) => {
        if (strokes === null || strokes === undefined) {
          return null;
        }
        if (!Number.isInteger(strokes) || strokes < 1) {
          throw new Error(`${name}'s scores must be positive whole numbers.`);
        }
        return strokes;
      });

      return { name, holes: validatedHoles };
    });
  }

  private createEmptyScorecard(): ScorecardEntry {
    return {
      name: '',
      holes: Array.from({ length: this.scorecardHoleCount }, () => null)
    };
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
