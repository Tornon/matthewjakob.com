import { Routes } from '@angular/router';
import { GolfLogComponent } from './golf-log/golf-log.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Matthew Jakob' },
  { path: 'golf-log', component: GolfLogComponent, title: 'Golf Log | Matthew Jakob' },
  { path: '**', redirectTo: '' }
];
