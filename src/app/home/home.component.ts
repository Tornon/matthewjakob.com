import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="glow" aria-hidden="true"></div>

    <main class="hero">
      <div class="tag">Software Developer</div>
      <h1>Matthew Jakob</h1>
      <p class="subtitle">Building software, solving problems, and continuously learning.</p>

      <p class="bio">
        Welcome to my corner of the internet. I'm a software developer interested in modern web
        development, cloud technologies, automation, and building applications that solve
        real-world problems.
      </p>

      <div class="buttons">
        <a class="btn primary" href="https://github.com/Tornon">GitHub</a>
        <a class="btn secondary" href="mailto:you@example.com">Contact</a>
      </div>

      <section class="pages" aria-labelledby="pages-heading">
        <h2 id="pages-heading">Pages</h2>
        <p class="pages-intro">A few things I've built for the site.</p>

        <a class="page-card" routerLink="/golf-log">
          <span class="page-card-label">Golf</span>
          <h3>Golf Log</h3>
          <p>A place to keep track of rounds played with friends.</p>
        </a>
      </section>

      <div class="tech" aria-label="Technologies">
        <span>C#</span>
        <span>.NET</span>
        <span>Angular</span>
        <span>TypeScript</span>
        <span>Azure</span>
        <span>SQL</span>
        <span>GitHub</span>
      </div>
    </main>
  `
})
export class HomeComponent {}
