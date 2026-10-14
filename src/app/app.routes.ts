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
  { path: '**', redirectTo: '' }
];
