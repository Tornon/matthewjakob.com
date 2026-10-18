import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GolfLogService,
  type GolfCourse,
  type GolfCourseGalleryImage,
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
      <h1>Notes &amp; Course Config</h1>
      <p class="intro">Ratings, course tips, hole-by-hole photos and notes, and course setup.</p>
      @if (!loading && !loadError && courses.length > 0) {
        <div class="course-filter-row">
          <label class="course-filter">
            Course
            <select name="selectedCourse" [ngModel]="selectedCourse" (ngModelChange)="selectCourse($event)">
              <option value="">Select a course</option>
              @for (course of courses; track course) {
                <option [value]="course">{{ course }}</option>
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
      }

      @if (loadError) {
        <p class="log-status error" role="alert">{{ loadError }}</p>
      } @else if (loading) {
        <p class="log-status" role="status">Loading course notes...</p>
      } @else if (courses.length === 0) {
        <p class="log-status">No courses are available yet. Add a course configuration below.</p>
      } @else if (!selectedCourse) {
        <p class="log-status">No course selected. Choose a course above, or use the configuration form below to add one.</p>
      } @else {
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

        <section class="course-notes-section" aria-labelledby="course-gallery-heading">
          <h2 id="course-gallery-heading">Course photos</h2>
          <p class="form-help">Photos of the food, facilities, clubhouse, and other course highlights.</p>
          @if (galleryImages.length === 0) {
            <p class="form-help">No course photos have been added yet.</p>
          } @else if (currentGalleryImage; as image) {
            <div class="course-gallery">
              <div class="course-gallery-viewer">
                <button
                  type="button"
                  class="course-gallery-arrow"
                  [disabled]="galleryImages.length < 2"
                  aria-label="Previous course photo"
                  (click)="moveGallery(-1)"
                >←</button>
                <figure class="course-gallery-slide">
                  <img [src]="image.imageUrl" [alt]="image.caption || 'Photo of ' + selectedCourse">
                  @if (image.caption) {
                    <figcaption>{{ image.caption }}</figcaption>
                  }
                </figure>
                <button
                  type="button"
                  class="course-gallery-arrow"
                  [disabled]="galleryImages.length < 2"
                  aria-label="Next course photo"
                  (click)="moveGallery(1)"
                >→</button>
              </div>
              <div class="course-gallery-footer">
                <span aria-live="polite">Photo {{ galleryIndex + 1 }} of {{ galleryImages.length }}</span>
                @if (canManage) {
                  <button
                    type="button"
                    class="danger-button"
                    [disabled]="saving"
                    (click)="removeGalleryImage(image)"
                  >Remove photo</button>
                }
              </div>
              @if (galleryImages.length > 1) {
                <div class="course-gallery-thumbnails" aria-label="Choose a course photo">
                  @for (galleryImage of galleryImages; track galleryImage.id; let index = $index) {
                    <button
                      type="button"
                      [class.selected]="galleryIndex === index"
                      [attr.aria-label]="'Show course photo ' + (index + 1) + (galleryImage.caption ? ': ' + galleryImage.caption : '')"
                      [attr.aria-current]="galleryIndex === index ? 'true' : null"
                      (click)="selectGalleryImage(index)"
                    >
                      <img [src]="galleryImage.imageUrl" alt="">
                    </button>
                  }
                </div>
              }
            </div>
          }
          @if (canManage) {
            <div class="course-gallery-upload">
              <label>
                Add a course photo (JPEG, PNG, or WebP; up to 5 MB)
                <input
                  name="course-gallery-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  [disabled]="saving"
                  (change)="selectGalleryPhoto($event)"
                >
              </label>
              <label>
                Caption (optional)
                <input
                  name="course-gallery-caption"
                  type="text"
                  maxlength="240"
                  [disabled]="saving"
                  [(ngModel)]="galleryCaptionDraft"
                >
              </label>
              <button
                type="button"
                [disabled]="saving || !selectedGalleryFile"
                (click)="uploadGalleryPhoto()"
              >{{ saving ? 'Uploading…' : 'Upload photo' }}</button>
              @if (selectedGalleryFile) {
                <span class="course-gallery-selected-file">{{ selectedGalleryFile.name }}</span>
              }
            </div>
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
                [class.has-photo]="!!holeImage(hole)"
                [class.no-photo]="!holeImage(hole)"
                [attr.aria-current]="selectedHole === hole ? 'true' : null"
                [attr.aria-label]="'Hole ' + hole + (holeImage(hole) ? ', photo available' : ', no photo')"
                (click)="selectHole(hole)"
              >{{ hole }}</button>
            }
          </nav>
          @if (selectedHole; as hole) {
            <div class="hole-detail-navigation">
              <button
                type="button"
                class="hole-detail-arrow"
                [attr.aria-label]="'Previous hole, ' + (hole === 1 ? holes.length : hole - 1)"
                title="Previous hole"
                (click)="moveHole(-1)"
              >←</button>
              <article class="hole-note-card" [attr.aria-labelledby]="'hole-heading-' + hole">
                <h3 [id]="'hole-heading-' + hole">
                  Hole {{ hole }}@if (selectedConfig) { <span>· Par {{ selectedConfig.pars[hole - 1] }}</span> }
                </h3>
                <div class="hole-photo-frame">
                  @if (holeImage(hole); as image) {
                    <img class="hole-photo" [src]="image.imageUrl" alt="Photo of {{ selectedCourse }}, hole {{ hole }}">
                  } @else {
                    <p class="hole-photo-empty">No photo for this hole yet.</p>
                  }
                </div>
                @if (canManage) {
                  <div class="hole-image-controls">
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
                    @if (holeImage(hole)) {
                      <button type="button" class="danger-button" [disabled]="saving" (click)="removeHoleImage(hole)">
                        Remove photo
                      </button>
                    }
                  </div>
                }

                <section class="hole-notes-content" aria-labelledby="hole-notes-content-heading">
                  <h4 id="hole-notes-content-heading">Hole notes</h4>
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
                  @if (canManage) {
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
                </section>
              </article>
              <button
                type="button"
                class="hole-detail-arrow"
                [attr.aria-label]="'Next hole, ' + (hole === holes.length ? 1 : hole + 1)"
                title="Next hole"
                (click)="moveHole(1)"
              >→</button>
            </div>
          }
        </section>
      }

      @if (canManage) {
        <form class="admin-form course-config-form" (ngSubmit)="saveConfiguration()">
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
                [ngModel]="configCourseName"
                (ngModelChange)="selectConfigurationCourse($event)"
              >
              <datalist id="course-names">
                @for (course of courses; track course) {
                  <option [value]="course"></option>
                }
              </datalist>
            </label>
          </div>
          @if (configurationCourse; as config) {
            <section class="course-image-settings" aria-labelledby="course-image-heading">
              <h3 id="course-image-heading">Scorecard watermark</h3>
              @if (config.backgroundImageUrl) {
                <div class="course-image-preview-frame">
                  <img
                    class="course-image-preview"
                    [src]="config.backgroundImageUrl"
                    alt="Preview of the scorecard watermark for {{ config.name }}"
                    [style.opacity]="backgroundImageOpacity"
                    [style.object-position]="backgroundImagePositionX + '% ' + backgroundImagePositionY + '%'"
                  >
                </div>
                <label>
                  Watermark opacity: {{ (backgroundImageOpacity * 100).toFixed(0) }}%
                  <input
                    name="backgroundImageOpacity"
                    type="range"
                    min="0.03"
                    max="0.5"
                    step="0.01"
                    [(ngModel)]="backgroundImageOpacity"
                  >
                </label>
                <label>
                  Horizontal image position: {{ backgroundImagePositionX }}%
                  <input
                    name="backgroundImagePositionX"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    [(ngModel)]="backgroundImagePositionX"
                  >
                </label>
                <label>
                  Vertical image position: {{ backgroundImagePositionY }}%
                  <input
                    name="backgroundImagePositionY"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    [(ngModel)]="backgroundImagePositionY"
                  >
                </label>
                <button
                  type="button"
                  class="secondary-button"
                  [disabled]="saving"
                  (click)="saveWatermarkSettings()"
                >Save watermark settings</button>
              } @else {
                <p class="form-help">Upload an image to show as a faint watermark behind this course's scorecards.</p>
              }
              <label>
                Course image (JPEG, PNG, or WebP; up to 5 MB)
                <input
                  name="courseBackgroundImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  [disabled]="saving"
                  (change)="selectBackgroundImage($event)"
                >
              </label>
              @if (selectedBackgroundFile) {
                <p class="form-help">Selected: {{ selectedBackgroundFile.name }}</p>
              }
              <button
                type="button"
                [disabled]="saving || !selectedBackgroundFile"
                (click)="uploadBackgroundImage()"
              >
                {{ saving ? 'Uploading...' : 'Upload course image' }}
              </button>
            </section>
            <section class="course-scorecard-settings" aria-labelledby="course-scorecard-heading">
              <h3 id="course-scorecard-heading">Course scorecard</h3>
              @if (config.scorecardUrl && config.scorecardPath) {
                @if (isPdfScorecard(config)) {
                  <p class="form-help">A PDF scorecard is available for {{ config.name }}.</p>
                } @else {
                  <div class="course-scorecard-preview-frame">
                    <img
                      class="course-scorecard-preview"
                      [src]="config.scorecardUrl"
                      alt="Course scorecard for {{ config.name }}"
                    >
                  </div>
                }
                <a
                  class="secondary-button course-scorecard-link"
                  [href]="config.scorecardUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >View current scorecard</a>
                <button
                  type="button"
                  class="danger-button"
                  [disabled]="saving"
                  (click)="removeCourseScorecard(config.name)"
                >Remove scorecard</button>
              } @else {
                <p class="form-help">Upload an image or PDF of this course's scorecard.</p>
              }
              <label>
                Scorecard file (JPEG, PNG, WebP, or PDF; up to 5 MB)
                <input
                  name="courseScorecard"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  [disabled]="saving"
                  (change)="selectCourseScorecard($event)"
                >
              </label>
              @if (selectedScorecardFile) {
                <p class="form-help">Selected: {{ selectedScorecardFile.name }}</p>
              }
              <button
                type="button"
                [disabled]="saving || !selectedScorecardFile"
                (click)="uploadCourseScorecard(config.name)"
              >
                {{ saving ? 'Uploading...' : 'Upload course scorecard' }}
              </button>
            </section>
          }
          <div class="course-par-settings">
            <h3>Course pars</h3>
            <label>
              Holes configured
              <select
                name="parHoleCount"
                [ngModel]="parHoleCount"
                (ngModelChange)="setParHoleCount($event)"
              >
                <option [ngValue]="9">9 holes</option>
                <option [ngValue]="18">18 holes</option>
              </select>
            </label>
            <fieldset class="par-entry">
              <legend>Par for each hole</legend>
              <div class="hole-entry-grid par-entry-grid">
                @for (par of pars; track $index; let holeIndex = $index) {
                  <label>
                    Hole {{ holeIndex + 1 }}
                    <input
                      [name]="'par-' + holeIndex"
                      type="number"
                      min="3"
                      max="6"
                      step="1"
                      inputmode="numeric"
                      [(ngModel)]="pars[holeIndex]"
                    >
                  </label>
                }
              </div>
            </fieldset>
          </div>
          <p class="form-help">
            Enter a par from 3 to 6 for every hole.
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

      @if (canManage && configurationCourse) {
        <form class="admin-form course-tee-time-form" (ngSubmit)="saveTeeTimeUrl()">
          <h2>Tee time booking link</h2>
          <label>
            Tee Time URL
            <input
              name="teeTimeUrl"
              type="url"
              maxlength="2048"
              placeholder="https://example.com/book"
              [(ngModel)]="teeTimeUrlDraft"
            >
          </label>
          <p class="form-help">
            Add a booking URL to show a BOOK TEE TIME button next to this course's selector.
            Leave blank and save to remove the button.
          </p>
          <button type="submit" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Save tee time URL' }}
          </button>
        </form>
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
  configCourseName = '';
  parHoleCount: 9 | 18 = 18;
  pars: (number | null)[] = Array.from({ length: 18 }, () => null);
  backgroundImageOpacity = 0.12;
  backgroundImagePositionX = 50;
  backgroundImagePositionY = 50;
  selectedBackgroundFile: File | null = null;
  selectedScorecardFile: File | null = null;
  teeTimeUrlDraft = '';
  notes: GolfCourseNote[] = [];
  ratingSummary: GolfCourseRatingSummary = { totalRatings: 0, averageRating: 0, myRating: 0 };
  holeImages: GolfCourseHoleImage[] = [];
  galleryImages: GolfCourseGalleryImage[] = [];
  selectedGalleryFile: File | null = null;
  galleryCaptionDraft = '';
  galleryIndex = 0;
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

  get selectedCourseTeeTimeUrl(): string | null {
    return this.selectedConfig?.teeTimeUrl?.trim() || null;
  }

  get currentGalleryImage(): GolfCourseGalleryImage | undefined {
    return this.galleryImages[this.galleryIndex];
  }

  isPdfScorecard(config: GolfCourse): boolean {
    return config.scorecardPath?.toLocaleLowerCase().endsWith('.pdf') ?? false;
  }

  get configurationCourse(): GolfCourse | undefined {
    return this.configs.find((course) =>
      course.name.toLocaleLowerCase() === this.configCourseName.trim().toLocaleLowerCase()
    );
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
      ) ?? (this.route.snapshot.queryParamMap.get('blank') === 'true' ? '' : this.courses[0] ?? '');
      if (this.selectedCourse) {
        this.loadConfigurationFields(this.selectedCourse);
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
    this.loadConfigurationFields(courseName);
    this.selectedHole = 1;
    this.notes = [];
    this.ratingSummary = { totalRatings: 0, averageRating: 0, myRating: 0 };
    this.holeImages = [];
    this.galleryImages = [];
    this.galleryIndex = 0;
    this.selectedGalleryFile = null;
    this.galleryCaptionDraft = '';
    this.notice = '';
    this.actionError = '';
    if (!courseName) {
      return;
    }
    try {
      await this.loadSelectedCourse();
    } catch (error) {
      console.error('Unable to load selected course notes.', error);
      this.actionError = this.describeError(error);
    }
  }

  selectConfigurationCourse(courseName: string): void {
    this.configCourseName = courseName;
    const existingCourse = this.courses.find(
      (course) => course.toLocaleLowerCase() === courseName.trim().toLocaleLowerCase()
    );
    if (existingCourse) {
      void this.selectCourse(existingCourse);
      return;
    }

    this.loadConfigurationFields(courseName);
  }

  setParHoleCount(holeCount: 9 | 18): void {
    this.parHoleCount = holeCount;
    this.pars = Array.from({ length: holeCount }, (_, index) => this.pars[index] ?? null);
  }

  async saveTeeTimeUrl(): Promise<void> {
    const config = this.configurationCourse;
    if (!this.canManage || !config) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.saveCourseTeeTimeUrl(config.name, this.teeTimeUrlDraft);
      const teeTimeUrl = this.teeTimeUrlDraft.trim() || null;
      this.configs = this.configs.map((course) =>
        course.name === config.name ? { ...course, teeTimeUrl } : course
      );
      this.teeTimeUrlDraft = teeTimeUrl ?? '';
      this.notice = teeTimeUrl
        ? `Tee time URL saved for ${config.name}.`
        : `Tee time URL removed for ${config.name}.`;
    });
  }

  selectBackgroundImage(event: Event): void {
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
      this.actionError = 'Course images must be 5 MB or smaller.';
      return;
    }
    this.selectedBackgroundFile = file;
  }

  async uploadBackgroundImage(): Promise<void> {
    const config = this.configurationCourse;
    const file = this.selectedBackgroundFile;
    if (!this.canManage || !config || !file) {
      this.actionError = 'Save this course configuration before uploading its image.';
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.uploadCourseBackground(
        config.name,
        file,
        Number(this.backgroundImageOpacity),
        Number(this.backgroundImagePositionX),
        Number(this.backgroundImagePositionY)
      );
      this.configs = await this.golfLog.getCourseConfigs();
      this.selectedBackgroundFile = null;
      this.notice = `Scorecard watermark uploaded for ${config.name}.`;
    });
  }

  async saveWatermarkSettings(): Promise<void> {
    const config = this.configurationCourse;
    if (!this.canManage || !config) {
      return;
    }
    await this.performAction(async () => {
      const savedSettings = await this.golfLog.updateCourseWatermarkSettings(
        config.name,
        Number(this.backgroundImageOpacity),
        Number(this.backgroundImagePositionX),
        Number(this.backgroundImagePositionY)
      );
      this.backgroundImageOpacity = savedSettings.opacity;
      this.backgroundImagePositionX = savedSettings.positionX;
      this.backgroundImagePositionY = savedSettings.positionY;
      this.configs = await this.golfLog.getCourseConfigs();
      this.notice = `Watermark settings saved for ${config.name}.`;
    });
  }

  selectCourseScorecard(event: Event): void {
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
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      this.actionError = 'Choose a JPEG, PNG, WebP, or PDF scorecard.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.actionError = 'Course scorecards must be 5 MB or smaller.';
      return;
    }
    this.selectedScorecardFile = file;
  }

  async uploadCourseScorecard(courseName: string): Promise<void> {
    const file = this.selectedScorecardFile;
    if (!this.canManage || !this.configurationCourse || !file) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.uploadCourseScorecard(courseName, file);
      this.configs = await this.golfLog.getCourseConfigs();
      this.selectedScorecardFile = null;
      this.notice = `Scorecard uploaded for ${courseName}.`;
    });
  }

  async removeCourseScorecard(courseName: string): Promise<void> {
    if (!this.canManage) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.deleteCourseScorecard(courseName);
      this.configs = await this.golfLog.getCourseConfigs();
      this.notice = `Scorecard removed for ${courseName}.`;
    });
  }

  async saveConfiguration(): Promise<void> {
    if (!this.canManage) {
      return;
    }
    await this.performAction(async () => {
      const name = this.configCourseName.trim();
      if (!name || name.length > 160) {
        throw new Error('Enter a course name between 1 and 160 characters.');
      }
      const pars = this.pars.filter((par): par is number => par !== null);
      if (pars.length !== this.parHoleCount ||
          pars.some((par) => !Number.isInteger(par) || par < 3 || par > 6)) {
        throw new Error('Enter a whole-number par from 3 to 6 for every hole.');
      }
      await this.golfLog.saveCourseConfig(name, pars);
      this.configs = await this.golfLog.getCourseConfigs();
      this.selectedCourse = name;
      this.configCourseName = name;
      this.loadConfigurationFields(name);
      this.selectedHole = 1;
      await this.loadSelectedCourse();
      this.notice = `Pars saved for ${name}.`;
    });
  }

  selectHole(holeNumber: number): void {
    this.selectedHole = holeNumber;
  }

  moveHole(direction: -1 | 1): void {
    const holeCount = this.holes.length;
    if (holeCount === 0) {
      return;
    }
    this.selectedHole = ((this.selectedHole - 1 + direction + holeCount) % holeCount) + 1;
  }

  notesForHole(holeNumber: number | null): GolfCourseNote[] {
    return this.notes.filter((note) => note.holeNumber === holeNumber);
  }

  holeImage(holeNumber: number): GolfCourseHoleImage | undefined {
    return this.holeImages.find((image) => image.holeNumber === holeNumber);
  }

  moveGallery(direction: -1 | 1): void {
    if (this.galleryImages.length < 2) {
      return;
    }
    this.galleryIndex = (this.galleryIndex + direction + this.galleryImages.length) % this.galleryImages.length;
  }

  selectGalleryImage(index: number): void {
    if (index >= 0 && index < this.galleryImages.length) {
      this.galleryIndex = index;
    }
  }

  selectGalleryPhoto(event: Event): void {
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
      this.actionError = 'Course photos must be 5 MB or smaller.';
      return;
    }
    this.selectedGalleryFile = file;
  }

  async uploadGalleryPhoto(): Promise<void> {
    const courseName = this.selectedCourse;
    const file = this.selectedGalleryFile;
    if (!this.canManage || !courseName || !file) {
      return;
    }
    await this.performAction(async () => {
      await this.golfLog.uploadCourseGalleryImage(
        courseName,
        file,
        this.galleryCaptionDraft
      );
      this.galleryImages = await this.golfLog.getCourseGalleryImages(courseName);
      this.galleryIndex = this.galleryImages.length - 1;
      this.selectedGalleryFile = null;
      this.galleryCaptionDraft = '';
      this.notice = `Photo added to the ${courseName} gallery.`;
    });
  }

  async removeGalleryImage(image: GolfCourseGalleryImage): Promise<void> {
    if (!this.canManage) {
      return;
    }
    const courseName = this.selectedCourse;
    const removedIndex = this.galleryImages.findIndex((item) => item.id === image.id);
    await this.performAction(async () => {
      await this.golfLog.deleteCourseGalleryImage(image.id);
      this.galleryImages = this.galleryImages.filter((item) => item.id !== image.id);
      this.galleryIndex = this.galleryImages.length === 0
        ? 0
        : Math.min(removedIndex, this.galleryImages.length - 1);
      this.notice = `Photo removed from the ${courseName} gallery.`;
    });
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
    const [notes, ratingSummary, images, galleryImages] = await Promise.all([
      this.golfLog.getCourseNotes(this.selectedCourse),
      this.golfLog.getCourseRatingSummary(this.selectedCourse),
      this.golfLog.getCourseHoleImages(this.selectedCourse),
      this.golfLog.getCourseGalleryImages(this.selectedCourse)
    ]);
    this.notes = notes;
    this.ratingSummary = ratingSummary;
    this.holeImages = images;
    this.galleryImages = galleryImages;
    this.galleryIndex = 0;
    this.ratingDraft = ratingSummary.myRating;
  }

  private loadConfigurationFields(courseName: string): void {
    this.configCourseName = courseName;
    const config = this.configs.find((course) =>
      course.name.toLocaleLowerCase() === courseName.trim().toLocaleLowerCase()
    );
    this.parHoleCount = config?.pars.length === 9 ? 9 : 18;
    this.pars = config
      ? Array.from({ length: this.parHoleCount }, (_, index) => config.pars[index] ?? null)
      : Array.from({ length: this.parHoleCount }, () => null);
    this.backgroundImageOpacity = config?.backgroundImageOpacity ?? 0.12;
    this.backgroundImagePositionX = config?.backgroundImagePositionX ?? 50;
    this.backgroundImagePositionY = config?.backgroundImagePositionY ?? 50;
    this.teeTimeUrlDraft = config?.teeTimeUrl ?? '';
    this.selectedBackgroundFile = null;
    this.selectedScorecardFile = null;
  }

  private async performAction(action: () => Promise<void>): Promise<void> {
    this.saving = true;
    this.actionError = '';
    this.notice = '';
    try {
      await action();
    } catch (error) {
      console.error('Unable to update golf course data.', error);
      this.actionError = this.describeError(error);
    } finally {
      this.saving = false;
    }
  }

  private describeError(error: unknown): string {
    const message = error instanceof Error
      ? error.message
      : (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : null
      );
    if (!message) {
      return 'An unexpected error occurred.';
    }
    if (message.includes("Could not find the table 'public.golf_course_gallery'")) {
      return 'Course gallery is not set up yet. Run supabase/course-gallery-migration.sql in the Supabase SQL Editor, then reload this page.';
    }
    return message;
  }
}
