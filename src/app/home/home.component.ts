import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="glow" aria-hidden="true"></div>

    <main class="hero">
      <section class="pages" aria-labelledby="pages-heading">
        <h2 id="pages-heading">Pages</h2>
        <p class="pages-intro">A few things I've built for the site.</p>

        <a class="page-card" routerLink="/golf-log">
          <span class="page-card-label">Golf</span>
          <h3>Golf Log</h3>
          <p>A place to keep track of rounds played with friends.</p>
        </a>
      </section>
    </main>
  `
})
export class HomeComponent {}
