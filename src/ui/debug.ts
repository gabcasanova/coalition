/**
 * The debug menu (Ctrl+Q). It can fast-forward the game: bots play every party (the humans' too), nothing waits for
 * a click and animations run at turbo speed. It runs either for a number of rounds (a round is one turn for every
 * party, so afterwards it is the same party's turn again) or until the next presidential or parliamentary
 * election, stopping just as it begins so the election itself plays at normal speed. It can also simulate
 * SIM_GAMES whole bot-only games in the background and report who won, who got the presidency, who formed
 * governments and more.
 */
import type { Engine } from '../core/engine';
import { setFastForward, settings } from '../core/settings';
import { simulate } from '../core/simulate';
import { PREBUILT_PARTIES } from '../data/parties';
import { L } from '../i18n';
import { simReportHTML } from './simReport';

/** How many games the simulation plays. */
const SIM_GAMES = 100;

type ElectionKind = 'presidential' | 'parliamentary';

/** What the current fast-forward is waiting for. */
type Target = { kind: 'rounds'; turnsLeft: number; turnsTotal: number } | { kind: ElectionKind; turns: number };

export class DebugMenu {
  private readonly el = document.createElement('div');
  private engine?: Engine;
  private target: Target | null = null;
  /** The simulation report window, and whether a simulation is running (and has been cancelled). */
  private readonly report = document.createElement('div');
  private simulating = false;
  private simCancelled = false;

  constructor() {
    this.el.id = 'debugmenu';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.report.id = 'simreport';
    this.report.className = 'hidden';
    document.body.appendChild(this.report);
    this.report.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (button?.dataset.sim === 'again') void this.runSimulation();
      else if (button?.dataset.sim === 'cancel') this.simCancelled = true;
      else if (button?.dataset.sim === 'close' || e.target === this.report) this.report.classList.add('hidden');
    });
    window.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || e.code !== 'KeyQ' || e.repeat) return;
      e.preventDefault();
      this.toggle();
    });
    this.el.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      if (button.dataset.rounds) this.fastForward(Number(button.dataset.rounds));
      else if (button.dataset.until) this.fastForwardUntil(button.dataset.until as ElectionKind);
      else if (button.dataset.act === 'stop') this.stop();
      else if (button.dataset.act === 'simulate') void this.runSimulation();
      else if (button.dataset.act === 'close') this.toggle(false);
    });
  }

  /** Connects the menu to a game in progress. */
  attach(engine: Engine): void {
    this.engine = engine;
    engine.onTurnEnd = () => this.turnEnded();
    engine.onElection = (kind) => this.electionStarts(kind);
    this.render();
  }

  private toggle(show = this.el.classList.contains('hidden')): void {
    this.el.classList.toggle('hidden', !show);
    if (show) this.render();
  }

  private canStart(): boolean {
    return !!this.engine && !this.engine.over && !settings.fastForward;
  }

  private fastForward(rounds: number): void {
    if (!this.canStart()) return;
    const turns = rounds * this.engine!.players.length;
    this.start({ kind: 'rounds', turnsLeft: turns, turnsTotal: turns });
  }

  private fastForwardUntil(kind: ElectionKind): void {
    if (this.canStart()) this.start({ kind, turns: 0 });
  }

  private start(target: Target): void {
    this.target = target;
    setFastForward(true);
    this.render();
  }

  private turnEnded(): void {
    const target = this.target;
    if (!settings.fastForward || !target) return;
    if (target.kind === 'rounds') {
      if (--target.turnsLeft <= 0) this.finish();
    } else target.turns++;
    if (this.engine?.over) this.finish();
    setTimeout(() => this.render()); // once the engine has moved on to the next party
  }

  /** An election is starting: if that is what we were waiting for, stop here so it plays at normal speed. */
  private electionStarts(kind: ElectionKind): void {
    if (!settings.fastForward || this.target?.kind !== kind) return;
    this.finish();
    this.render();
  }

  private finish(): void {
    this.target = null;
    setFastForward(false);
  }

  private stop(): void {
    this.finish();
    this.render();
  }

  /**
   * Plays SIM_GAMES bot-only games with the current game's parties (the first four prebuilt ones before a game
   * starts) and shows the report. The game on the table is left alone.
   */
  private async runSimulation(): Promise<void> {
    if (this.simulating) return;
    this.simulating = true;
    this.simCancelled = false;
    const parties = this.engine ? this.engine.players.map((p) => p.party) : PREBUILT_PARTIES.slice(0, 4);
    const progress = (done: number) => {
      this.report.innerHTML = `<div class="srpanel srprogress">
        <div class="srtitle">📊 ${L('Simulating…', 'Simulando…')}</div>
        <p>${L(`Game ${done} of ${SIM_GAMES}`, `Partida ${done} de ${SIM_GAMES}`)} · ${parties.map((p) => p.name).join(', ')}</p>
        <div class="dbbar"><div style="width:${(done / SIM_GAMES) * 100}%"></div></div>
        <button data-sim="cancel">${L('Cancel', 'Cancelar')}</button>
      </div>`;
    };
    progress(0);
    this.report.classList.remove('hidden');
    try {
      const result = await simulate(parties, SIM_GAMES, progress, () => this.simCancelled);
      this.report.innerHTML = `<div class="srpanel">
        ${result.games ? simReportHTML(result) : `<p>${L('Cancelled.', 'Cancelado.')}</p>`}
        <div class="srbuttons">
          <button data-sim="again">🔁 ${L(`Run ${SIM_GAMES} more`, `Simular mais ${SIM_GAMES}`)}</button>
          <button data-sim="close">${L('Close', 'Fechar')}</button>
        </div>
      </div>`;
    } finally {
      this.simulating = false;
    }
  }

  private render(): void {
    const engine = this.engine;
    const target = this.target;
    let body: string;
    const simButton = `<button data-act="simulate" class="dbsim">📊 ${L(`Simulate ${SIM_GAMES} games and show the stats`, `Simular ${SIM_GAMES} partidas e ver as estatísticas`)}</button>`;
    if (!engine) {
      body = `<p>${L('Start a game to fast-forward it.', 'Comece uma partida para acelerá-la.')}</p>${simButton}`;
    } else if (settings.fastForward && target) {
      let progress: string;
      let bar = '';
      if (target.kind === 'rounds') {
        const done = target.turnsTotal - target.turnsLeft;
        progress = L(`turn ${done + 1} of ${target.turnsTotal}`, `turno ${done + 1} de ${target.turnsTotal}`);
        bar = `<div class="dbbar"><div style="width:${(done / target.turnsTotal) * 100}%"></div></div>`;
      } else {
        const until =
          target.kind === 'presidential'
            ? L('until the presidential election', 'até a eleição presidencial')
            : L('until the parliamentary election', 'até a eleição parlamentar');
        progress = `${until} · ${L(`${target.turns} turns so far`, `${target.turns} turnos até agora`)}`;
        bar = `<div class="dbbar dbwait"><div></div></div>`;
      }
      body = `<p>⏩ ${L('Bots are playing…', 'Os bots estão jogando…')} <b>${progress}</b></p>
        ${bar}
        <button data-act="stop">⏹ ${L('Stop', 'Parar')}</button>`;
    } else {
      const presidentialDone = engine.presidentialYear >= engine.year;
      body = `<p>${L(
        'Bots play every party (yours too) with no pauses and turbo animations. A round is one turn for every party.',
        'Os bots jogam por todos os partidos (inclusive o seu), sem pausas e com animações turbo. Uma rodada é um turno de cada partido.',
      )}</p>
        <div class="dbrow">
          <button data-rounds="1">⏩ ${L('Simulate 1 round', 'Simular 1 rodada')}</button>
          <button data-rounds="5">⏩ ${L('5 rounds', '5 rodadas')}</button>
        </div>
        <p class="dbsub">${L('Simulate until an election, then watch it at normal speed:', 'Simular até uma eleição e assisti-la em velocidade normal:')}</p>
        <div class="dbrow">
          <button data-until="presidential" title="${presidentialDone ? L("This year's has been held: runs on to next year's.", 'A deste ano já aconteceu: segue até a do próximo ano.') : ''}">🎖️ ${L('Until the presidential', 'Até a presidencial')}${presidentialDone ? L(' (next year)', ' (próximo ano)') : ''}</button>
          <button data-until="parliamentary">🗳️ ${L('Until the parliamentary', 'Até a parlamentar')}</button>
        </div>
        <p class="dbsub">${L('Or play many games with these parties, all bots, in the background:', 'Ou jogue muitas partidas com estes partidos, só bots, em segundo plano:')}</p>
        ${simButton}`;
    }
    const where = engine
      ? `<div class="dbstate">${L('Year', 'Ano')} ${engine.year} · ${L('Turn', 'Vez')}: ${engine.current.party.name}</div>`
      : '';
    this.el.innerHTML = `<div class="dbtitle">🐞 Debug <span>Ctrl+Q</span><button class="dbclose" data-act="close">✕</button></div>
      ${where}${body}`;
  }
}
