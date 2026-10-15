import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  courseHoleIndex,
  GolfLogService,
  type GolfCourse,
  type GolfRound
} from '../golf-log/golf-log.service';

interface HoleResult {
  course: string;
  date: string;
  hole: number;
  par: number;
  strokes: number;
  toPar: number;
}

interface HoleAverage {
  course: string;
  hole: number;
  count: number;
  averageToPar: number;
}

@Component({
  selector: 'app-golf-player-stats',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="golf-log player-stats-page">
      <a
        class="back-link"
        routerLink="/golf-courses"
        [queryParams]="{ course: course || null, player }"
      >&larr; Back to Course Details</a>
      <h1>{{ player || 'Player' }} Hole Stats</h1>
      <p class="intro">
        {{ course ? 'Stats for ' + course : 'Stats across all courses' }}.
        Hole results are compared with that course's configured par.
      </p>

      @if (loadError) {
        <p class="log-status error" role="alert">{{ loadError }}</p>
      } @else if (loading) {
        <p class="log-status" role="status">Loading player hole stats...</p>
      } @else if (!player) {
        <p class="log-status error" role="alert">Choose a player from Course Details to view their hole stats.</p>
      } @else {
        <div class="player-average-grid">
          <section class="player-average-section player-best-section" aria-labelledby="best-holes-heading">
            <h2 id="best-holes-heading">10 lowest average scores vs. par</h2>
            <p class="player-stats-help">
              Each course and hole needs at least two recorded scores.
            </p>
            @if (bestAverages.length === 0) {
              <p class="log-status">No holes have at least two recorded scores.</p>
            } @else {
              <ol class="average-hole-list">
                @for (hole of bestAverages; track hole.course + hole.hole) {
                  <li>
                    <strong>{{ formatToPar(hole.averageToPar) }}</strong>
                    <span>{{ hole.course }} · Hole {{ hole.hole }}</span>
                    <small>{{ hole.count }} rounds</small>
                  </li>
                }
              </ol>
            }
          </section>

          <section class="player-average-section player-worst-average-section" aria-labelledby="worst-average-heading">
            <h2 id="worst-average-heading">10 highest average scores vs. par</h2>
            <p class="player-stats-help">
              Each course and hole needs at least two recorded scores.
            </p>
            @if (worstAverages.length === 0) {
              <p class="log-status">No holes have at least two recorded scores.</p>
            } @else {
              <ol class="average-hole-list">
                @for (hole of worstAverages; track hole.course + hole.hole) {
                  <li>
                    <strong>{{ formatToPar(hole.averageToPar) }}</strong>
                    <span>{{ hole.course }} · Hole {{ hole.hole }}</span>
                    <small>{{ hole.count }} rounds</small>
                  </li>
                }
              </ol>
            }
          </section>
        </div>

        <section class="player-worst-section" aria-labelledby="worst-holes-heading">
          <h2 id="worst-holes-heading">20 worst individual holes</h2>
          <p class="player-stats-help">
            Ranked from most strokes over par. Only recorded scores with a configured par are included.
          </p>
          @if (worstHoles.length === 0) {
            <p class="log-status">No recorded holes with configured pars for this player.</p>
          } @else {
            <ol class="worst-hole-list">
              @for (result of worstHoles; track $index) {
                <li>
                  <span class="worst-hole-rank">#{{ $index + 1 }}</span>
                  <strong class="worst-hole-difference">{{ formatToPar(result.toPar) }}</strong>
                  <span class="worst-hole-detail">
                    <strong>{{ result.course }} · Hole {{ result.hole }}</strong>
                    <span>{{ formatDate(result.date) }} · {{ result.strokes }} strokes on par {{ result.par }}</span>
                  </span>
                </li>
              }
            </ol>
          }
        </section>
      }
    </main>
  `
})
export class GolfPlayerStatsComponent implements OnInit {
  rounds: GolfRound[] = [];
  configs: GolfCourse[] = [];
  player = '';
  course = '';
  loading = true;
  loadError = '';

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly route: ActivatedRoute
  ) {}

  get worstHoles(): HoleResult[] {
    return this.holeResults
      .sort((left, right) =>
        right.toPar - left.toPar ||
        right.strokes - left.strokes ||
        right.date.localeCompare(left.date) ||
        left.course.localeCompare(right.course) ||
        left.hole - right.hole
      )
      .slice(0, 20);
  }

  get bestAverages(): HoleAverage[] {
    return this.holeAverages
      .sort((left, right) =>
        left.averageToPar - right.averageToPar ||
        right.count - left.count ||
        left.course.localeCompare(right.course) ||
        left.hole - right.hole
      )
      .slice(0, 10);
  }

  get worstAverages(): HoleAverage[] {
    return this.holeAverages
      .sort((left, right) =>
        right.averageToPar - left.averageToPar ||
        right.count - left.count ||
        left.course.localeCompare(right.course) ||
        left.hole - right.hole
      )
      .slice(0, 10);
  }

  private get holeResults(): HoleResult[] {
    const targetPlayer = this.player.trim().toLocaleLowerCase();
    return this.rounds
      .filter((round) => !this.course || this.courseKey(round.course) === this.courseKey(this.course))
      .flatMap((round) => {
        const playerCard = [
          { name: round.playerName, holes: round.holes },
          ...round.friends
        ].find((scorecard) => scorecard.name.trim().toLocaleLowerCase() === targetPlayer);
        if (!playerCard) {
          return [];
        }

        const course = this.configs.find(
          (config) => this.courseKey(config.name) === this.courseKey(round.course)
        );
        if (!course) {
          return [];
        }

        const results: HoleResult[] = [];
        for (let scoreIndex = 0; scoreIndex < playerCard.holes.length; scoreIndex += 1) {
          const strokes = playerCard.holes[scoreIndex];
          if (strokes === null) {
            continue;
          }
          const parIndex = courseHoleIndex(
            course.pars.length,
            round.holes,
            round.startingHole,
            scoreIndex
          );
          if (parIndex === null) {
            continue;
          }
          const par = course.pars[parIndex];
          results.push({
            course: round.course,
            date: round.date,
            hole: parIndex + 1,
            par,
            strokes,
            toPar: strokes - par
          });
        }
        return results;
      });
  }

  private get holeAverages(): HoleAverage[] {
    const grouped = new Map<string, { course: string; hole: number; count: number; totalToPar: number }>();
    for (const result of this.holeResults) {
      const key = `${this.courseKey(result.course)}|${result.hole}`;
      const aggregate = grouped.get(key) ?? {
        course: result.course,
        hole: result.hole,
        count: 0,
        totalToPar: 0
      };
      aggregate.count += 1;
      aggregate.totalToPar += result.toPar;
      grouped.set(key, aggregate);
    }

    return [...grouped.values()]
      .filter((aggregate) => aggregate.count >= 2)
      .map((aggregate) => ({
        course: aggregate.course,
        hole: aggregate.hole,
        count: aggregate.count,
        averageToPar: aggregate.totalToPar / aggregate.count
      }));
  }

  async ngOnInit(): Promise<void> {
    this.player = this.route.snapshot.queryParamMap.get('player')?.trim() ?? '';
    this.course = this.route.snapshot.queryParamMap.get('course')?.trim() ?? '';
    try {
      const [rounds, configs] = await Promise.all([
        this.golfLog.getRounds(),
        this.golfLog.getCourseConfigs()
      ]);
      this.rounds = rounds;
      this.configs = configs;
    } catch (error) {
      console.error('Unable to load player hole stats.', error);
      this.loadError = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      this.loading = false;
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
  }

  formatToPar(difference: number): string {
    const rounded = Math.round(difference * 100) / 100;
    const formatted = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
    return rounded === 0 ? 'E' : rounded > 0 ? `+${formatted}` : formatted;
  }

  private courseKey(courseName: string): string {
    return courseName.trim().toLocaleLowerCase();
  }
}
