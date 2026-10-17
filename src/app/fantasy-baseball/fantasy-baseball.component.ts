import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { GolfLogService } from '../golf-log/golf-log.service';
import {
  FantasyBaseballService,
  type FantasyLineupSlot,
  type FantasyPlayer,
  type FantasyPlayerType,
  type FantasySeasonStats
} from './fantasy-baseball.service';

interface Team {
  code: string;
  name: string;
}

interface LineupPosition {
  id: string;
  label: string;
  type: FantasyPlayerType;
}

const TEAMS: Team[] = [
  { code: 'ARI', name: 'Arizona Diamondbacks' },
  { code: 'ATL', name: 'Atlanta Braves' },
  { code: 'BAL', name: 'Baltimore Orioles' },
  { code: 'BOS', name: 'Boston Red Sox' },
  { code: 'CHC', name: 'Chicago Cubs' },
  { code: 'CWS', name: 'Chicago White Sox' },
  { code: 'CIN', name: 'Cincinnati Reds' },
  { code: 'CLE', name: 'Cleveland Guardians' },
  { code: 'COL', name: 'Colorado Rockies' },
  { code: 'DET', name: 'Detroit Tigers' },
  { code: 'HOU', name: 'Houston Astros' },
  { code: 'KC', name: 'Kansas City Royals' },
  { code: 'LAA', name: 'Los Angeles Angels' },
  { code: 'LAD', name: 'Los Angeles Dodgers' },
  { code: 'MIA', name: 'Miami Marlins' },
  { code: 'MIL', name: 'Milwaukee Brewers' },
  { code: 'MIN', name: 'Minnesota Twins' },
  { code: 'NYM', name: 'New York Mets' },
  { code: 'NYY', name: 'New York Yankees' },
  { code: 'ATH', name: 'Athletics' },
  { code: 'PHI', name: 'Philadelphia Phillies' },
  { code: 'PIT', name: 'Pittsburgh Pirates' },
  { code: 'SD', name: 'San Diego Padres' },
  { code: 'SF', name: 'San Francisco Giants' },
  { code: 'SEA', name: 'Seattle Mariners' },
  { code: 'STL', name: 'St. Louis Cardinals' },
  { code: 'TB', name: 'Tampa Bay Rays' },
  { code: 'TEX', name: 'Texas Rangers' },
  { code: 'TOR', name: 'Toronto Blue Jays' },
  { code: 'WSH', name: 'Washington Nationals' }
];

const LINEUP_POSITIONS: LineupPosition[] = [
  { id: '1B', label: '1B', type: 'hitter' },
  { id: '2B', label: '2B', type: 'hitter' },
  { id: '3B', label: '3B', type: 'hitter' },
  { id: 'SS', label: 'SS', type: 'hitter' },
  { id: 'OF1', label: 'OF', type: 'hitter' },
  { id: 'OF2', label: 'OF', type: 'hitter' },
  { id: 'OF3', label: 'OF', type: 'hitter' },
  { id: 'DH', label: 'DH', type: 'hitter' },
  { id: 'SP1', label: 'SP', type: 'pitcher' },
  { id: 'SP2', label: 'SP', type: 'pitcher' },
  { id: 'SP3', label: 'SP', type: 'pitcher' },
  { id: 'SP4', label: 'SP', type: 'pitcher' },
  { id: 'SP5', label: 'SP', type: 'pitcher' },
  { id: 'CL', label: 'CL', type: 'pitcher' },
  { id: 'RP', label: 'RP', type: 'pitcher' }
];

@Component({
  selector: 'app-fantasy-baseball',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="fantasy-baseball">
      <a class="back-link" routerLink="/">Back to Pages</a>
      <header class="fantasy-heading">
        <div>
          <p class="page-card-label">Fantasy Baseball</p>
          <h1>{{ viewHeading }}</h1>
          <p class="fantasy-intro">Rank players, manage MLB starting lineups, and track season stats.</p>
        </div>
        @if (isOwner) {
          <button type="button" class="secondary-button" [disabled]="busy" (click)="signOut()">Sign out</button>
        }
      </header>

      <nav class="fantasy-nav" aria-label="Fantasy Baseball">
        <button type="button" [class.active]="view === 'rankings'" [attr.aria-current]="view === 'rankings' ? 'page' : null" (click)="view = 'rankings'">Rankings</button>
        <button type="button" [class.active]="view === 'rosters'" [attr.aria-current]="view === 'rosters' ? 'page' : null" (click)="view = 'rosters'">Team Rosters</button>
        <button type="button" [class.active]="view === 'stats'" [attr.aria-current]="view === 'stats' ? 'page' : null" (click)="view = 'stats'">Player Stats</button>
      </nav>

      @if (error) {
        <p class="log-status error" role="alert">{{ error }}</p>
      }
      @if (notice) {
        <p class="log-status" role="status">{{ notice }}</p>
      }

      @if (loading) {
        <p class="log-status" role="status">Loading fantasy baseball data…</p>
      } @else {
        @if (!isOwner && !checkingAccess) {
          <details class="admin-panel fantasy-sign-in">
            <summary>Sign in to manage fantasy baseball</summary>
            <form class="admin-form sign-in-form" (ngSubmit)="signIn()">
              <div class="form-grid">
                <label>
                  Email
                  <input name="email" type="email" autocomplete="username" required [(ngModel)]="email">
                </label>
                <label>
                  Password
                  <input name="password" type="password" autocomplete="current-password" required [(ngModel)]="password">
                </label>
              </div>
              <button type="submit" [disabled]="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
            </form>
          </details>
        }

        @if (view === 'rankings') {
          <section class="fantasy-panel" aria-labelledby="fantasy-rankings-heading">
            <div class="fantasy-section-heading">
              <div>
                <h2 id="fantasy-rankings-heading">Player Rankings</h2>
                <p class="fantasy-help">Drag players to rank them. Players without a current starting spot remain here, with their stats intact.</p>
              </div>
            </div>
            @if (players.length === 0) {
              <p class="log-status">Players added to a team roster will appear here.</p>
            } @else {
              <ol class="fantasy-ranking-list">
                @for (player of players; track player.id; let index = $index) {
                  <li
                    class="fantasy-ranking-row"
                    [draggable]="isOwner && !busy"
                    (dragstart)="startDrag($event, player.id)"
                    (dragover)="$event.preventDefault()"
                    (drop)="dropPlayer($event, player.id)"
                    [class.dragging]="draggedPlayerId === player.id"
                  >
                    <span class="fantasy-drag-handle" aria-hidden="true">⠿</span>
                    <span class="fantasy-rank-number">{{ index + 1 }}</span>
                    <span class="fantasy-rank-player">
                      <strong>{{ player.name }}</strong>
                      <span>{{ currentAssignment(player.id) || 'No current starting spot' }}</span>
                    </span>
                    <span class="fantasy-player-type">{{ player.type }}</span>
                    <span class="fantasy-rank-actions">
                      <button type="button" [disabled]="!isOwner || busy || index === 0" [attr.aria-label]="'Move ' + player.name + ' up'" (click)="movePlayer(index, -1)">↑</button>
                      <button type="button" [disabled]="!isOwner || busy || index === players.length - 1" [attr.aria-label]="'Move ' + player.name + ' down'" (click)="movePlayer(index, 1)">↓</button>
                    </span>
                  </li>
                }
              </ol>
            }
          </section>
        }

        @if (view === 'rosters') {
          <section class="fantasy-panel" aria-labelledby="fantasy-rosters-heading">
            <h2 id="fantasy-rosters-heading">Team Starting Lineups</h2>
            <p class="fantasy-help">Each team has 15 starting spots. Changing a spot never deletes a player or their season stats.</p>
            <div class="fantasy-roster-controls">
              <label>
                MLB team
                <select name="rosterTeam" [(ngModel)]="selectedTeam">
                  @for (team of teams; track team.code) {
                    <option [value]="team.code">{{ team.name }}</option>
                  }
                </select>
              </label>
            </div>
            @if (isOwner) {
              <form class="admin-form fantasy-add-player" (ngSubmit)="addPlayer()">
                <h3>Add a player</h3>
                <div class="form-grid">
                  <label>
                    Player name
                    <input name="newPlayerName" type="text" maxlength="120" required [(ngModel)]="newPlayerName">
                  </label>
                  <label>
                    Player type
                    <select name="newPlayerType" [(ngModel)]="newPlayerType">
                      <option value="hitter">Hitter</option>
                      <option value="pitcher">Pitcher</option>
                    </select>
                  </label>
                </div>
                <button type="submit" [disabled]="busy">{{ busy ? 'Saving…' : 'Add player' }}</button>
              </form>
            }
            <div class="fantasy-lineup-grid">
              @for (position of lineupPositions; track position.id) {
                <label class="fantasy-lineup-slot">
                  <span>{{ position.label }}{{ position.id.length > position.label.length ? ' ' + position.id.slice(position.label.length) : '' }}</span>
                  <select
                    [name]="'lineup-' + selectedTeam + '-' + position.id"
                    [disabled]="!isOwner || busy"
                    [ngModel]="lineupPlayer(selectedTeam, position.id)"
                    (ngModelChange)="saveLineup(selectedTeam, position, $event)"
                  >
                    <option [ngValue]="null">Open</option>
                    @for (player of availablePlayersFor(selectedTeam, position.id, position.type); track player.id) {
                      <option [ngValue]="player.id">{{ player.name }}</option>
                    }
                  </select>
                </label>
              }
            </div>
            @if (!isOwner) {
              <p class="fantasy-help">Rosters are publicly viewable. Sign in with the authorized account to make changes.</p>
            }
          </section>
        }

        @if (view === 'stats') {
          <section class="fantasy-panel" aria-labelledby="fantasy-stats-heading">
            <h2 id="fantasy-stats-heading">Player Stats</h2>
            <p class="fantasy-help">Stats are stored by player and season. The three most recent seasons are shown; older entries are retained.</p>
            <div class="fantasy-stats-controls">
              <label>
                Player
                <select name="statsPlayer" [(ngModel)]="selectedStatsPlayerId" (ngModelChange)="loadSelectedSeason()">
                  <option value="">Select a player</option>
                  @for (player of players; track player.id) {
                    <option [value]="player.id">{{ player.name }}{{ currentAssignment(player.id) ? ' — ' + currentAssignment(player.id) : ' — no current spot' }}</option>
                  }
                </select>
              </label>
              <label>
                Season
                <select name="statsSeason" [(ngModel)]="selectedStatsSeason" (ngModelChange)="loadSelectedSeason()">
                  @for (season of seasons; track season) {
                    <option [ngValue]="season">{{ season }}</option>
                  }
                </select>
              </label>
            </div>
            @if (!selectedStatsPlayerId) {
              <p class="log-status">Add a player on Team Rosters, then select them here to enter stats.</p>
            } @else {
              <form class="admin-form fantasy-stats-form" (ngSubmit)="saveStats()">
                <label class="fantasy-player-type-control">
                  Player type
                  <select
                    name="statsPlayerType"
                    [disabled]="!isOwner || busy"
                    [ngModel]="selectedStatsPlayer?.type"
                    (ngModelChange)="changePlayerType($event)"
                  >
                    <option value="hitter">Hitter</option>
                    <option value="pitcher">Pitcher</option>
                  </select>
                </label>
                <label class="fantasy-mlb-checkbox">
                  <input name="playedMlb" type="checkbox" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.playedMlb">
                  Played in MLB this season
                </label>
                @if (selectedStatsPlayer?.type === 'hitter') {
                  <h3>Hitter stats · {{ selectedStatsSeason }}</h3>
                  <div class="form-grid fantasy-stat-grid">
                    <label>Age<input name="age" type="number" min="0" max="100" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.age"></label>
                    <label>wOBA<input name="woba" type="number" min="0" max="2" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.woba"></label>
                    <label>xwOBA<input name="xwoba" type="number" min="0" max="2" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.xwoba"></label>
                    <label>BA<input name="ba" type="number" min="0" max="1" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.ba"></label>
                    <label>OBP<input name="obp" type="number" min="0" max="1" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.obp"></label>
                    <label>SLG<input name="slg" type="number" min="0" max="5" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.slg"></label>
                    <label>OPS<input name="ops" type="number" min="0" max="5" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.ops"></label>
                    <label>HR<input name="hr" type="number" min="0" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.hr"></label>
                    <label>SB<input name="sb" type="number" min="0" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.sb"></label>
                    <label>RBI<input name="rbi" type="number" min="0" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.rbi"></label>
                    <label>R<input name="runs" type="number" min="0" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.runs"></label>
                    <label>BB%<input name="bbPercent" type="number" min="0" max="100" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.bbPercent"></label>
                    <label>K%<input name="kPercent" type="number" min="0" max="100" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.kPercent"></label>
                  </div>
                  <p class="fantasy-help">Enter rate stats as decimals (for example, .320) and percentages as percentage points (for example, 8.5 for 8.5%).</p>
                } @else {
                  <h3>Pitcher stats · {{ selectedStatsSeason }}</h3>
                  <div class="form-grid fantasy-stat-grid">
                    <label>Age<input name="age" type="number" min="0" max="100" step="1" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.age"></label>
                    <label>ERA<input name="era" type="number" min="0" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.era"></label>
                    <label>xERA<input name="xera" type="number" min="0" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.xera"></label>
                    <label>IP<input name="inningsPitched" type="number" min="0" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.inningsPitched"></label>
                    <label>K/9<input name="kPer9" type="number" min="0" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.kPer9"></label>
                    <label>K%<input name="kPercent" type="number" min="0" max="100" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.kPercent"></label>
                    <label>BB%<input name="bbPercent" type="number" min="0" max="100" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.bbPercent"></label>
                    <label>K-BB%<input name="kMinusBbPercent" type="number" min="-100" max="100" step="any" [disabled]="!isOwner || busy" [(ngModel)]="seasonDraft.kMinusBbPercent"></label>
                  </div>
                  <p class="fantasy-help">Enter percentages as percentage points (for example, 24.0 for 24.0%).</p>
                }
                <button type="submit" [disabled]="!isOwner || busy">{{ busy ? 'Saving…' : 'Save ' + selectedStatsSeason + ' stats' }}</button>
              </form>
              @if (!isOwner) {
                <p class="fantasy-help">Stats are publicly viewable. Sign in with the authorized account to make changes.</p>
              }
            }
          </section>
        }
      }
    </main>
  `
})
export class FantasyBaseballComponent implements OnInit, OnDestroy {
  readonly teams = TEAMS;
  readonly lineupPositions = LINEUP_POSITIONS;
  readonly seasons = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];
  players: FantasyPlayer[] = [];
  lineups: FantasyLineupSlot[] = [];
  view: 'rankings' | 'rosters' | 'stats' = 'rankings';
  selectedTeam = 'ARI';
  selectedStatsPlayerId = '';
  selectedStatsSeason = this.seasons[0];
  newPlayerName = '';
  newPlayerType: FantasyPlayerType = 'hitter';
  seasonDraft = this.emptySeasonDraft();
  draggedPlayerId: string | null = null;
  email = '';
  password = '';
  isOwner = false;
  checkingAccess = true;
  loading = true;
  busy = false;
  error = '';
  notice = '';

  private playerSeasons: FantasySeasonStats[] = [];
  private unsubscribeAuth?: () => void;

  constructor(
    private readonly golfLog: GolfLogService,
    private readonly fantasyBaseball: FantasyBaseballService
  ) {}

  get selectedStatsPlayer(): FantasyPlayer | undefined {
    return this.players.find((player) => player.id === this.selectedStatsPlayerId);
  }

  get viewHeading(): string {
    if (this.view === 'rosters') {
      return 'Team Rosters';
    }
    if (this.view === 'stats') {
      return 'Player Stats';
    }
    return 'Player Rankings';
  }

  async ngOnInit(): Promise<void> {
    try {
      const [players, lineups, session] = await Promise.all([
        this.fantasyBaseball.getPlayers(),
        this.fantasyBaseball.getLineups(),
        this.golfLog.getSession()
      ]);
      this.players = players;
      this.lineups = lineups;
      this.unsubscribeAuth = await this.golfLog.onAuthStateChange((authSession) => {
        void this.refreshAccess(authSession);
      });
      await this.refreshAccess(session);
    } catch (error) {
      console.error('Unable to load Fantasy Baseball.', error);
      this.error = this.describeError(error);
      this.checkingAccess = false;
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
  }

  async signIn(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.golfLog.signIn(this.email.trim(), this.password);
      this.password = '';
      await this.refreshAccess(await this.golfLog.getSession());
      this.notice = this.isOwner ? 'Signed in. You can now manage Fantasy Baseball.' : 'This account has read-only access.';
    } catch (error) {
      console.error('Unable to sign in to Fantasy Baseball.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async signOut(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.golfLog.signOut();
      this.isOwner = false;
      this.notice = 'You have been signed out.';
    } catch (error) {
      console.error('Unable to sign out of Fantasy Baseball.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async addPlayer(): Promise<void> {
    const name = this.newPlayerName.trim();
    if (!name) {
      return;
    }
    if (this.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      this.error = 'A player with that name already exists. Select the existing player instead.';
      return;
    }

    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const player = await this.fantasyBaseball.addPlayer(name, this.newPlayerType, this.players.length + 1);
      this.players = [...this.players, player];
      this.newPlayerName = '';
      this.notice = `${player.name} added. They are now available for team lineups, rankings, and stats.`;
    } catch (error) {
      console.error('Unable to add fantasy baseball player.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  lineupPlayer(team: string, slot: string): string | null {
    return this.lineups.find((entry) => entry.team === team && entry.slot === slot)?.playerId ?? null;
  }

  availablePlayersFor(team: string, slot: string, type: FantasyPlayerType): FantasyPlayer[] {
    const currentId = this.lineupPlayer(team, slot);
    const assignedElsewhere = new Set(
      this.lineups
        .filter((entry) => entry.playerId && !(entry.team === team && entry.slot === slot))
        .map((entry) => entry.playerId)
    );
    return this.players.filter((player) =>
      (player.type === type && !assignedElsewhere.has(player.id)) || player.id === currentId
    );
  }

  async saveLineup(team: string, position: LineupPosition, playerId: string | null): Promise<void> {
    const previous = this.lineups;
    this.error = '';
    this.notice = '';
    this.busy = true;
    try {
      await this.fantasyBaseball.saveLineupSlot(team, position.id, playerId);
      this.lineups = [
        ...this.lineups.filter((entry) => !(entry.team === team && entry.slot === position.id)),
        { team, slot: position.id, playerId }
      ];
      this.notice = `${this.teamName(team)} ${position.label} lineup updated.`;
    } catch (error) {
      console.error('Unable to update fantasy baseball lineup.', error);
      this.lineups = previous;
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  currentAssignment(playerId: string): string | null {
    const assignment = this.lineups.find((entry) => entry.playerId === playerId);
    if (!assignment) {
      return null;
    }
    const position = this.lineupPositions.find((item) => item.id === assignment.slot);
    return `${this.teamName(assignment.team)} · ${position?.label ?? assignment.slot}`;
  }

  teamName(code: string): string {
    return this.teams.find((team) => team.code === code)?.name ?? code;
  }

  startDrag(event: DragEvent, playerId: string): void {
    this.draggedPlayerId = playerId;
    event.dataTransfer?.setData('text/plain', playerId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  async dropPlayer(event: DragEvent, targetId: string): Promise<void> {
    event.preventDefault();
    const draggedId = event.dataTransfer?.getData('text/plain') || this.draggedPlayerId;
    this.draggedPlayerId = null;
    if (!draggedId || draggedId === targetId || !this.isOwner || this.busy) {
      return;
    }
    const fromIndex = this.players.findIndex((player) => player.id === draggedId);
    const toIndex = this.players.findIndex((player) => player.id === targetId);
    if (fromIndex >= 0 && toIndex >= 0) {
      await this.reorderPlayers(fromIndex, toIndex);
    }
  }

  async movePlayer(index: number, offset: number): Promise<void> {
    const target = index + offset;
    if (target < 0 || target >= this.players.length || !this.isOwner || this.busy) {
      return;
    }
    await this.reorderPlayers(index, target);
  }

  async loadSelectedSeason(): Promise<void> {
    this.error = '';
    this.seasonDraft = this.emptySeasonDraft();
    if (!this.selectedStatsPlayerId) {
      return;
    }
    try {
      this.playerSeasons = await this.fantasyBaseball.getPlayerSeasons(this.selectedStatsPlayerId);
      const saved = this.playerSeasons.find((item) => item.season === Number(this.selectedStatsSeason));
      if (saved) {
        this.seasonDraft = { ...saved };
      }
    } catch (error) {
      console.error('Unable to load fantasy baseball player stats.', error);
      this.error = this.describeError(error);
    }
  }

  async changePlayerType(type: FantasyPlayerType): Promise<void> {
    const player = this.selectedStatsPlayer;
    if (!player || !this.isOwner || player.type === type) {
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await this.fantasyBaseball.updatePlayerType(player.id, type);
      this.players = this.players.map((item) => item.id === player.id ? { ...item, type } : item);
      this.notice = `${player.name} is now listed as a ${type}.`;
    } catch (error) {
      console.error('Unable to update fantasy baseball player type.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  async saveStats(): Promise<void> {
    if (!this.isOwner || !this.selectedStatsPlayerId) {
      return;
    }
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.fantasyBaseball.savePlayerSeason({
        ...this.seasonDraft,
        playerId: this.selectedStatsPlayerId,
        season: Number(this.selectedStatsSeason)
      });
      this.notice = `${this.selectedStatsPlayer?.name ?? 'Player'}'s ${this.selectedStatsSeason} stats saved.`;
      await this.loadSelectedSeason();
    } catch (error) {
      console.error('Unable to save fantasy baseball player stats.', error);
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  private async refreshAccess(session: Session | null): Promise<void> {
    this.checkingAccess = true;
    try {
      this.isOwner = session ? await this.fantasyBaseball.isOwner() : false;
    } catch (error) {
      console.error('Unable to verify Fantasy Baseball edit access.', error);
      this.isOwner = false;
      this.error = this.describeError(error);
    } finally {
      this.checkingAccess = false;
    }
  }

  private async reorderPlayers(fromIndex: number, toIndex: number): Promise<void> {
    const previous = [...this.players];
    const updated = [...this.players];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    this.players = updated;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.fantasyBaseball.saveRankings(updated.map((player) => player.id));
      this.players = updated.map((player, index) => ({ ...player, ranking: index + 1 }));
      this.notice = 'Player rankings saved.';
    } catch (error) {
      console.error('Unable to save fantasy baseball rankings.', error);
      this.players = previous;
      this.error = this.describeError(error);
    } finally {
      this.busy = false;
    }
  }

  private emptySeasonDraft(): FantasySeasonStats {
    return {
      playerId: '',
      season: this.seasons?.[0] ?? new Date().getFullYear(),
      playedMlb: false,
      age: null,
      woba: null,
      xwoba: null,
      ba: null,
      obp: null,
      slg: null,
      ops: null,
      hr: null,
      sb: null,
      rbi: null,
      runs: null,
      bbPercent: null,
      kPercent: null,
      era: null,
      xera: null,
      inningsPitched: null,
      kPer9: null,
      kMinusBbPercent: null
    };
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      if (error.message.includes("Could not find the table 'public.fantasy_baseball_")) {
        return 'Fantasy Baseball tables are missing. Run supabase/fantasy-baseball-migration.sql in the Supabase SQL Editor, then reload this page.';
      }
      return error.message;
    }
    return 'An unexpected error occurred.';
  }
}
