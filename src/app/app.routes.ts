import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Pages' },
  {
    path: 'golf-log',
    loadComponent: () =>
      import('./golf-log/golf-log.component').then((module) => module.GolfLogComponent),
    title: 'Golf Log'
  },
  {
    path: 'golf-courses',
    loadComponent: () =>
      import('./golf-courses/golf-courses.component').then((module) => module.GolfCoursesComponent),
    title: 'Course Details & Stats'
  },
  {
    path: 'golf-player-stats',
    loadComponent: () =>
      import('./golf-courses/golf-player-stats.component').then((module) => module.GolfPlayerStatsComponent),
    title: 'Player Hole Stats'
  },
  {
    path: 'golf-course-notes',
    loadComponent: () =>
      import('./golf-courses/golf-course-notes.component').then((module) => module.GolfCourseNotesComponent),
    title: 'Notes & Course Config'
  },
  {
    path: 'poker-stats',
    loadComponent: () =>
      import('./poker-stats/poker-stats.component').then((module) => module.PokerStatsComponent),
    title: 'Poker Stats'
  },
  { path: '**', redirectTo: '' }
];
