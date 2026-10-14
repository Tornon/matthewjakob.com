import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GolfLogService,
  type GolfCourse,
  type GolfCourseHoleImage,
  type GolfCourseNote,
  type GolfCourseRatingSummary,
  type GolfRound
} from '../golf-log/golf-log.service';

@Component({
  selector: 'app-golf-course-notes',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="golf-log course-notes-page">
      <a class="back-link" routerLink="/golf-courses" [queryParams]="{ course: selectedCourse }">
        &larr; Back to Course Details
      </a>
      <a class="secondary-button course-notes-back-log" routerLink="/golf-log">
        Back to Golf Log
      </a>
      <h1>Course Notes</h1>
      <p class="intro">Ratings, course tips, and hole-by-hole photos and notes.</p>

      @if (loadError) {
        <p class="log-status error" role="alert">{{ loadError }}</p>
      } @else if (loading) {
        <p class="log-status" role="status">Loading course notes...</p>
      } @else if (courses.length === 0) {
        <p class="log-status">No courses are available yet.</p>
      } @else {
        <label class="course-filter">
          Course
          <select name="selectedCourse" [ngModel]="selectedCourse" (ngModelChange)="selectCourse($event)">
            @for (course of courses; track course) {
              <option [value]="course">{{ course }}</option>
            }
          </select>
        </label>

        <section class="course-notes-section" aria-labelledby="course-rating-heading">
          <h2 id="course-rating-heading">{{ selectedCourse }}</h2>
          <div class="course-rating-summary">
            <strong>{{ ratingSummary.averageRating ? ratingSummary.averageRating.toFixed(1) : '—' }}</strong>
            <span class="rating-stars" aria-label="Average course rating">
              @for (star of ratingStars; track star) {
                <span [class.rating-star-filled]="star <= roundedAverageRating" aria-hidden="true">★</span>
              }
            </span>
            <span>{{ ratingSummary.totalRatings }} {{ ratingSummary.totalRatings === 1 ? 'rating' : 'ratings' }}</span>
          </div>

          @if (canManage) {
            <form class="course-note-form" (ngSubmit)="saveRating()">
              <div class="rating-control">
                <span>Your rating</span>
                <span class="rating-picker">
                  @for (star of ratingStars; track star) {
                    <button
                      type="button"
                      [class.rating-star-filled]="star <= ratingDraft"
                      [attr.aria-label]="'Rate ' + star + ' out of 5 stars'"
                      [attr.aria-pressed]="star === ratingDraft"
                      (click)="ratingDraft = star"
                    >★</button>
                  }
                </span>
              </div>
              <button type="submit" [disabled]="saving || ratingDraft < 1">
                {{ ratingSummary.myRating ? 'Update rating' : 'Save rating' }}
              </button>
            </form>
          } @else {
            <p class="form-help">Sign in as a golf log admin to rate the course or add notes.</p>
            <a routerLink="/golf-log">Go to Golf Log sign-in</a>
          }
        </section>

        <section class="course-notes-section" aria-labelledby="general-notes-heading">
          <h2 id="general-notes-heading">General course notes</h2>
          @if (canManage) {
            <form class="course-note-form" (ngSubmit)="addNote(null)">
              <label>
                Add a note
                <textarea
                  name="generalNoteDraft"
                  rows="3"
                  maxlength="1000"
                  required
                  placeholder="Food, facilities, pace of play, course conditions..."
                  [(ngModel)]="generalNoteDraft"
                ></textarea>
              </label>
              <button type="submit" [disabled]="saving || !generalNoteDraft.trim()">Add note</button>
            </form>
          }
          @if (notesForHole(null).length === 0) {
            <p class="form-help">No general notes yet.</p>
          } @else {
            <ul class="course-note-list">
              @for (note of notesForHole(null); track note.id) {
                <li>
                  <p>{{ note.note }}</p>
                  @if (canManage) {
                    <button type="button" class="danger-button" [disabled]="saving" (click)="removeNote(note)">
                      Remove
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <section class="course-notes-section hole-notes-section" aria-labelledby="hole-notes-heading">
          <h2 id="hole-notes-heading">Hole-by-hole notes</h2>
          <p class="form-help">
            {{ selectedConfig ? selectedConfig.pars.length : 18 }} holes are shown.
            @if (!selectedConfig) { Configure this course to set its hole count. }
          </p>
          <nav class="hole-selector" aria-label="Select a hole">
            @for (hole of holes; track hole) {
              <button
                type="button"
                [class.selected]="selectedHole === hole"
                [attr.aria-current]="selectedHole === hole ? 'true' : null"
                (click)="selectHole(hole)"
              >{{ hole }}</button>
            }
          </nav>
          @if (selectedHole; as hole) {
            <article class="hole-note-card" [attr.aria-labelledby]="'hole-heading-' + hole">
              <h3 [id]="'hole-heading-' + hole">
                Hole {{ hole }}@if (selectedConfig) { <span>· Par {{ selectedConfig.pars[hole - 1] }}</span> }
              </h3>
              @if (holeImage(hole); as image) {
                <img class="hole-photo" [src]="image.imageUrl" alt="Photo of {{ selectedCourse }}, hole {{ hole }}">
                @if (canManage) {
                  <button type="button" class="danger-button" [disabled]="saving" (click)="removeHoleImage(hole)">
                    Remove photo
                  </button>
                }
              } @else {
                <p class="form-help">No hole photo added yet.</p>
              }

              @if (canManage) {
                <div class="hole-photo-upload">
                  <label>
                    {{ holeImage(hole) ? 'Replace photo' : 'Upload hole photo' }} (JPEG, PNG, or WebP; up to 5 MB)
                    <input
                      [name]="'hole-photo-' + hole"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      [disabled]="saving"
                      (change)="selectHolePhoto(hole, $event)"
                    >
                  </label>
                  @if (holePhotoFiles[hole]) {
                    <button type="button" [disabled]="saving" (click)="uploadHolePhoto(hole)">
                      {{ saving ? 'Uploading...' : 'Save hole photo' }}
                    </button>
                  }
                </div>
                <form class="course-note-form" (ngSubmit)="addNote(hole)">
                  <label>
                    Add a hole note
                    <textarea
                      [name]="'hole-note-' + hole"
                      rows="2"
                      maxlength="1000"
                      required
                      [placeholder]="'Tips or observations for hole ' + hole"
                      [(ngModel)]="holeNoteDrafts[hole]"
                    ></textarea>
                  </label>
                  <button type="submit" [disabled]="saving || !holeNoteDrafts[hole]?.trim()">Add note</button>
                </form>
              }

              @if (notesForHole(hole).length === 0) {
                <p class="form-help">No notes for this hole yet.</p>
              } @else {
                <ul class="course-note-list">
                  @for (note of notesForHole(hole); track note.id) {
                    <li>
                      <p>{{ note.note }}</p>
                      @if (canManage) {
                        <button type="button" class="danger-button" [disabled]="saving" (click)="removeNote(note)">
                          Remove
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
            </article>
          }
        </section>
      }

      @if (notice) {
        <p class="log-status" role="status">{{ notice }}</p>
      }
      @if (actionError) {
        <p class="log-status error" role="alert">{{ actionError }}</p>
      }
    </main>
  `
})
export class GolfCourseNotesComponent implements OnInit {
  rounds: GolfRound[] = [];
  configs: GolfCourse[] = [];
  notes: GolfCourseNote[] = [];
  ratingSummary: GolfCourseRatingSummary = { totalRatings: 0, averageRating: 0, myRating: 0 };
  holeImages: GolfCourseHoleImage[] = [];
  selectedCourse = '';
  selectedHole = 1;
  loading = true;
  saving = false;
  canManage = false;
  loadError = '';
  actionError = '';
  notice = '';
  generalNoteDraft = '';
  ratingDraft = 0;
  holeNoteDrafts: Record<number, string> = {};
  holePhotoFiles: Record<number, File | null> = {};
  readonly ratingStars = [1, 2, 3, 4, 5];

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly route: ActivatedRoute
  ) {}

  get courses(): string[] {
    return [...new Set([
      ...this.rounds.map((round) => round.course),
      ...this.configs.map((course) => course.name)
    ])].sort((left, right) => left.localeCompare(right));
  }

  get selectedConfig(): GolfCourse | undefined {
    return this.configs.find((course) => course.name === this.selectedCourse);
  }

  get holes(): number[] {
    return Array.from({ length: this.selectedConfig?.pars.length ?? 18 }, (_, index) => index + 1);
  }

  get roundedAverageRating(): number {
    return Math.round(this.ratingSummary.averageRating);
  }

  async ngOnInit(): Promise<void> {
    try {
      const [rounds, configs, session] = await Promise.all([
        this.golfLog.getRounds(),
        this.golfLog.getCourseConfigs(),
        this.golfLog.getSession()
      ]);
      this.rounds = rounds;
      this.configs = configs;
      this.canManage = session !== null && await this.golfLog.isAdmin();

      const requestedCourse = this.route.snapshot.queryParamMap.get('course');
      this.selectedCourse = this.courses.find(
        (course) => course.toLocaleLowerCase() === requestedCourse?.toLocaleLowerCase()
      ) ?? this.courses[0] ?? '';
      if (this.selectedCourse) {
        await this.loadSelectedCourse();
      }
    } catch (error) {
      console.error('Unable to load golf course notes.', error);
      this.loadError = this.describeError(error);
    } finally {
      this.loading = false;
    }
  }

  async selectCourse(courseName: string): Promise<void> {
    this.selectedCourse = courseName;
    this.selectedHole = 1;
    this.notes = [];
    this.ratingSummary = { totalRatings: 0, averageRating: 0, myRating: 0 };
    this.holeImages = [];
    this.notice = '';
    this.actionError = '';
    try {
      await this.loadSelectedCourse();
    } catch (error) {
      console.error('Unable to load selected course notes.', error);
      this.actionError = this.describeError(error);
    }
  }

  selectHole(holeNumber: number): void {
    this.selectedHole = holeNumber;
  }

  notesForHole(holeNumber: number | null): GolfCourseNote[] {
    return this.notes.filter((note) => note.holeNumber === holeNumber);
  }

  holeImage(holeNumber: number): GolfCourseHoleImage | undefined {
    return this.holeImages.find((image) => image.holeNumber === holeNumber);
  }

  async saveRating(): Promise<void> {
    if (!this.canManage || this.ratingDraft < 1 || this.ratingDraft > 5) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.saveCourseRating(this.selectedCourse, this.ratingDraft);
      this.ratingSummary = await this.golfLog.getCourseRatingSummary(this.selectedCourse);
      this.notice = `Your rating for ${this.selectedCourse} was saved.`;
    });
  }

  async addNote(holeNumber: number | null): Promise<void> {
    const draft = holeNumber === null ? this.generalNoteDraft : this.holeNoteDrafts[holeNumber] ?? '';
    if (!this.canManage || !draft.trim()) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.addCourseNote(this.selectedCourse, holeNumber, draft);
      this.notes = await this.golfLog.getCourseNotes(this.selectedCourse);
      if (holeNumber === null) {
        this.generalNoteDraft = '';
      } else {
        this.holeNoteDrafts[holeNumber] = '';
      }
      this.notice = holeNumber === null ? 'Course note added.' : `Note added for hole ${holeNumber}.`;
    });
  }

  async removeNote(note: GolfCourseNote): Promise<void> {
    if (!this.canManage) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.deleteCourseNote(note.id);
      this.notes = await this.golfLog.getCourseNotes(this.selectedCourse);
      this.notice = 'Course note removed.';
    });
  }

  selectHolePhoto(holeNumber: number, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.actionError = '';
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.actionError = 'Choose a JPEG, PNG, or WebP image.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.actionError = 'Hole photos must be 5 MB or smaller.';
      return;
    }
    this.holePhotoFiles[holeNumber] = file;
  }

  async uploadHolePhoto(holeNumber: number): Promise<void> {
    const file = this.holePhotoFiles[holeNumber];
    if (!this.canManage || !file) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.uploadCourseHoleImage(this.selectedCourse, holeNumber, file);
      this.holeImages = await this.golfLog.getCourseHoleImages(this.selectedCourse);
      this.holePhotoFiles[holeNumber] = null;
      this.notice = `Photo saved for hole ${holeNumber}.`;
    });
  }

  async removeHoleImage(holeNumber: number): Promise<void> {
    if (!this.canManage) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.deleteCourseHoleImage(this.selectedCourse, holeNumber);
      this.holeImages = await this.golfLog.getCourseHoleImages(this.selectedCourse);
      this.notice = `Photo removed for hole ${holeNumber}.`;
    });
  }

  private async loadSelectedCourse(): Promise<void> {
    const [notes, ratingSummary, images] = await Promise.all([
      this.golfLog.getCourseNotes(this.selectedCourse),
      this.golfLog.getCourseRatingSummary(this.selectedCourse),
      this.golfLog.getCourseHoleImages(this.selectedCourse)
    ]);
    this.notes = notes;
    this.ratingSummary = ratingSummary;
    this.holeImages = images;
    this.ratingDraft = ratingSummary.myRating;
  }

  private async performAction(action: () => Promise<void>): Promise<void> {
    this.saving = true;
    this.actionError = '';
    this.notice = '';
    try {
      await action();
    } catch (error) {
      console.error('Unable to update course notes.', error);
      this.actionError = this.describeError(error);
    } finally {
      this.saving = false;
    }
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
