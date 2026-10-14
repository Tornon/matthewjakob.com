import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  courseHoleIndex,
  GolfLogService,
  type GolfCourse,
  type GolfFriendScore,
  type GolfRound
} from '../golf-log/golf-log.service';

interface CoursePlayerScore {
  name: string;
  holes: (number | null)[];
}

interface HoleStats {
  number: number;
  par: number;
  recorded: number;
  strokes: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  tripleBogeys: number;
  worse: number;
}

interface RoundPlayerStats {
  date: string;
  player: string;
  score: number | null;
  par: number | null;
}

@Component({
  selector: 'app-golf-courses',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="golf-log">
      <a class="back-link" routerLink="/golf-log">&larr; Back to Golf Log</a>
      <h1>Course Details</h1>
      <p class="intro">Configure hole pars and review player performance by course.</p>

      @if (loadError) {
        <p class="log-status error" role="alert">{{ loadError }}</p>
      } @else if (loading) {
        <p class="log-status" role="status">Loading course details...</p>
      } @else {
        @if (courses.length > 0) {
          <label class="course-filter">
            Course
            <select name="selectedCourse" [ngModel]="selectedCourse" (ngModelChange)="selectCourse($event)">
              @for (course of courses; track course) {
                <option [value]="course">
                  {{ course }}{{ isCourseConfigured(course) ? '' : ' — Setup needed' }}
                </option>
              }
            </select>
          </label>
        }

        @if (selectedCourse) {
          <section class="course-details" aria-labelledby="course-heading">
            <h2 id="course-heading">{{ selectedCourse }}</h2>
            @if (!selectedConfig) {
              <div class="course-setup-notice">
                <span class="course-setup-badge">Par setup needed</span>
                <p>Hole-by-hole stats are unavailable until this course's pars are configured.</p>
                @if (canManage) {
                  <a href="#course-configuration">Configure this course <span aria-hidden="true">↓</span></a>
                }
              </div>
            } @else {
              <label class="course-filter">
                Player stats
                <select name="selectedPlayer" [(ngModel)]="selectedPlayer">
                  <option value="">All players</option>
                  @for (player of players; track player) {
                    <option [value]="player">{{ player }}</option>
                  }
                </select>
              </label>
              <p class="form-help">
                Averages and counts include recorded holes only. Birdie or better includes
                eagles and better; worse means four or more over par.
              </p>
              <div class="scorecard-scroll">
                <table class="scorecard stats-table">
                  <caption>{{ selectedCourse }} hole statistics</caption>
                  <thead>
                    <tr>
                      <th scope="col">Hole</th>
                      <th scope="col">Par</th>
                      <th scope="col">Avg. strokes</th>
                      <th scope="col">Birdie or better</th>
                      <th scope="col">Par</th>
                      <th scope="col">Bogey</th>
                      <th scope="col">Double bogey</th>
                      <th scope="col">Triple bogey</th>
                      <th scope="col">Worse</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (hole of holeStats; track hole.number) {
                      <tr>
                        <th scope="row">{{ hole.number }}</th>
                        <td>{{ hole.par }}</td>
                        <td>{{ hole.recorded ? (hole.strokes / hole.recorded).toFixed(2) : '-' }}</td>
                        <td>{{ hole.birdies }}</td>
                        <td>{{ hole.pars }}</td>
                        <td>{{ hole.bogeys }}</td>
                        <td>{{ hole.doubleBogeys }}</td>
                        <td>{{ hole.tripleBogeys }}</td>
                        <td>{{ hole.worse }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <h3 class="course-section-heading">Round results</h3>
              @if (roundPlayerStats.length === 0) {
                <p class="log-status">No recorded scores for this course and player selection.</p>
              } @else {
                <div class="scorecard-scroll">
                  <table class="scorecard stats-table">
                    <caption>{{ selectedCourse }} round results</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Player</th>
                        <th scope="col">Strokes</th>
                        <th scope="col">Par</th>
                        <th scope="col">To par</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (result of roundPlayerStats; track $index) {
                        <tr>
                          <td>{{ formatDate(result.date) }}</td>
                          <th scope="row">{{ result.player }}</th>
                          <td>{{ result.score ?? '-' }}</td>
                          <td>{{ result.par ?? '-' }}</td>
                          <td>{{ result.score === null || result.par === null ? '-' : formatToPar(result.score - result.par) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
          </section>
        } @else if (courses.length === 0) {
          <p class="log-status">No courses are configured or present in the golf log yet.</p>
        }
      }

      @if (notice) {
        <p class="log-status" role="status">{{ notice }}</p>
      }
      @if (saveError) {
        <p class="log-status error" role="alert">{{ saveError }}</p>
      }

      @if (canManage) {
        <form id="course-configuration" class="admin-form course-config-form" (ngSubmit)="saveConfiguration()">
          <h2>Course configuration</h2>
          <div class="form-grid">
            <label>
              Course name
              <input
                name="configCourseName"
                type="text"
                list="course-names"
                maxlength="160"
                required
                [(ngModel)]="configCourseName"
              >
              <datalist id="course-names">
                @for (course of courses; track course) {
                  <option [value]="course"></option>
                }
              </datalist>
            </label>
            <label class="wide-field">
              Hole pars, in order (comma-separated)
              <input
                name="pars"
                type="text"
                required
                placeholder="4, 4, 3, 5, 4, 4, 3, 5, 4"
                [(ngModel)]="parsInput"
              >
            </label>
          </div>
          <p class="form-help">
            Enter 9 or 18 pars in hole order. Each par must be a whole number from 3 to 6.
            For a 9-hole scorecard on an 18-hole course, choose front or back nine when adding
            the round in the Golf Log.
          </p>
          <button type="submit" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Save course pars' }}
          </button>
        </form>
      } @else {
        <p class="form-help course-config-access">
          Sign in as an authorized admin on the <a routerLink="/golf-log">Golf Log</a> to configure course pars.
        </p>
      }
    </main>
  `
})
export class GolfCoursesComponent implements OnInit {
  rounds: GolfRound[] = [];
  courseConfigs: GolfCourse[] = [];
  loading = true;
  saving = false;
  canManage = false;
  loadError = '';
  saveError = '';
  notice = '';
  selectedCourse = '';
  selectedPlayer = '';
  configCourseName = '';
  parsInput = '';

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly route: ActivatedRoute
  ) {}

  get courses(): string[] {
    return [...new Set([
      ...this.rounds.map((round) => round.course),
      ...this.courseConfigs.map((course) => course.name)
    ])].sort((left, right) => left.localeCompare(right));
  }

  get selectedConfig(): GolfCourse | undefined {
    return this.courseConfigs.find((course) => course.name === this.selectedCourse);
  }

  isCourseConfigured(courseName: string): boolean {
    return this.courseConfigs.some((course) =>
      course.name.toLocaleLowerCase() === courseName.toLocaleLowerCase()
    );
  }

  get selectedCourseRounds(): GolfRound[] {
    return this.rounds.filter((round) => round.course === this.selectedCourse);
  }

  get players(): string[] {
    return [...new Set(this.selectedCourseRounds.flatMap((round) =>
      this.roundPlayers(round).map((player) => player.name)
    ))].sort((left, right) => left.localeCompare(right));
  }

  get holeStats(): HoleStats[] {
    const pars = this.selectedConfig?.pars;
    if (!pars) {
      return [];
    }

    const stats = pars.map((par, index) => ({
      number: index + 1,
      par,
      recorded: 0,
      strokes: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubleBogeys: 0,
      tripleBogeys: 0,
      worse: 0
    }));

    for (const round of this.selectedCourseRounds) {
      for (const player of this.roundPlayers(round)) {
        if (!this.matchesSelectedPlayer(player.name)) {
          continue;
        }

        for (let index = 0; index < player.holes.length; index += 1) {
          const strokes = player.holes[index];
          const parIndex = courseHoleIndex(
            pars.length,
            round.holes,
            round.startingHole,
            index
          );
          if (strokes === null || parIndex === null) {
            continue;
          }

          const hole = stats[parIndex];
          hole.recorded += 1;
          hole.strokes += strokes;
          if (strokes < hole.par) {
            hole.birdies += 1;
          } else if (strokes === hole.par) {
            hole.pars += 1;
          } else if (strokes === hole.par + 1) {
            hole.bogeys += 1;
          } else if (strokes === hole.par + 2) {
            hole.doubleBogeys += 1;
          } else if (strokes === hole.par + 3) {
            hole.tripleBogeys += 1;
          } else {
            hole.worse += 1;
          }
        }
      }
    }

    return stats;
  }

  get roundPlayerStats(): RoundPlayerStats[] {
    const pars = this.selectedConfig?.pars;
    if (!pars) {
      return [];
    }

    return this.selectedCourseRounds.flatMap((round) =>
      this.roundPlayers(round)
        .filter((player) => this.matchesSelectedPlayer(player.name))
        .map((player) => {
          let score = 0;
          let par = 0;
          let recorded = 0;
          let allRecordedHolesHavePars = true;

          for (let index = 0; index < player.holes.length; index += 1) {
            const strokes = player.holes[index];
            if (strokes === null) {
              continue;
            }

            recorded += 1;
            score += strokes;
            const parIndex = courseHoleIndex(
              pars.length,
              round.holes,
              round.startingHole,
              index
            );
            if (parIndex === null) {
              allRecordedHolesHavePars = false;
            } else {
              par += pars[parIndex];
            }
          }

          return {
            date: round.date,
            player: player.name,
            score: recorded > 0 ? score : null,
            par: recorded > 0 && allRecordedHolesHavePars ? par : null
          };
        })
    ).sort((left, right) =>
      right.date.localeCompare(left.date) || left.player.localeCompare(right.player)
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      const [rounds, courseConfigs, session] = await Promise.all([
        this.golfLog.getRounds(),
        this.golfLog.getCourseConfigs(),
        this.golfLog.getSession()
      ]);
      this.rounds = rounds;
      this.courseConfigs = courseConfigs;
      const requestedCourse = this.route.snapshot.queryParamMap.get('course');
      this.selectedCourse = this.courses.find(
        (course) => course.toLocaleLowerCase() === requestedCourse?.toLocaleLowerCase()
      ) ?? this.courses[0] ?? '';
      this.selectCourse(this.selectedCourse);
      this.canManage = session !== null && await this.golfLog.isAdmin();
    } catch (error) {
      console.error('Unable to load golf course details.', error);
      this.loadError = this.describeError(error);
    } finally {
      this.loading = false;
    }
  }

  selectCourse(course: string): void {
    this.selectedCourse = course;
    this.selectedPlayer = '';
    this.configCourseName = course;
    const config = this.courseConfigs.find((item) => item.name === course);
    this.parsInput = config?.pars.join(', ') ?? '';
  }

  async saveConfiguration(): Promise<void> {
    this.saving = true;
    this.saveError = '';
    this.notice = '';

    try {
      const name = this.configCourseName.trim();
      if (!name || name.length > 160) {
        throw new Error('Enter a course name between 1 and 160 characters.');
      }

      const tokens = this.parsInput.split(',').map((token) => token.trim());
      if (![9, 18].includes(tokens.length)) {
        throw new Error('Enter exactly 9 or 18 hole pars.');
      }

      const pars = tokens.map((token) => Number(token));
      if (pars.some((par) => !Number.isInteger(par) || par < 3 || par > 6)) {
        throw new Error('Each hole par must be a whole number from 3 to 6.');
      }

      await this.golfLog.saveCourseConfig(name, pars);
      this.courseConfigs = await this.golfLog.getCourseConfigs();
      this.selectedCourse = name;
      this.selectedPlayer = '';
      this.configCourseName = name;
      this.parsInput = pars.join(', ');
      this.notice = `Pars saved for ${name}.`;
    } catch (error) {
      console.error('Unable to save course configuration.', error);
      this.saveError = this.describeError(error);
    } finally {
      this.saving = false;
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
  }

  formatToPar(difference: number): string {
    return difference === 0 ? 'E' : difference > 0 ? `+${difference}` : `${difference}`;
  }

  private roundPlayers(round: GolfRound): CoursePlayerScore[] {
    return [
      { name: round.playerName, holes: round.holes },
      ...round.friends.map((friend: GolfFriendScore) => ({ name: friend.name, holes: friend.holes }))
    ];
  }

  private matchesSelectedPlayer(player: string): boolean {
    return !this.selectedPlayer || player.toLocaleLowerCase() === this.selectedPlayer.toLocaleLowerCase();
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
  }
}
