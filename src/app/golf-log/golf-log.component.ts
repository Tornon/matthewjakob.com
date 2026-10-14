import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-golf-log',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="golf-log">
      <a class="back-link" routerLink="/">&larr; Back to home</a>
      <div class="tag">Golf</div>
      <h1>Golf Log</h1>
      <p class="intro">A place to keep track of rounds played with friends.</p>

      <section class="empty-state" aria-labelledby="empty-heading">
        <h2 id="empty-heading">No rounds yet</h2>
        <p>The golf log is getting ready for its first round.</p>
      </section>
    </main>
  `
})
export class GolfLogComponent {}
