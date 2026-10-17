import type { ElectionResult, Engine, GameResult, PresidentialResult, Story } from '../../core/engine';
import { sound } from '../../audio';
import { fastForwardSignal, settings } from '../../core/settings';
import type { Player, Prompt, Tone } from '../../core/types';
import { L } from '../../i18n';
import { nowPlayingHTML, showBanner, showStory, showTurnCard } from './announcements';
import { showElectionNight } from './electionNight';
import { showPresidentialNight } from './presidentialNight';
import { showGameOver } from './gameOver';
import { showHelp } from './help';
import { HistoryLog } from './history';
import { byId, css } from './html';
import { handHTML, playersHTML, seatBarHTML, squareTooltipHTML, topBarHTML } from './panels';
import { showDraft, showPrompt, showSpinPrompt } from './prompts';

/**
 * The HTML overlay on top of the 3D table: top bar, party panels, parliament bar, hand drawer, news stories,
 * prompts for human players, election night and the final screen. The containers are in index.html.
 */
export class Hud {
  /** Toggles the cinematic camera; returns the new state. */
  onToggleCamera?: () => boolean;
  /** Hooks into the 3D wheel: `armWheel` resolves when the player clicks it. */
  armWheel?: () => Promise<void>;
  disarmWheel?: () => void;

  private engine?: Engine;
  /** The human whose cards and big panel are shown (the one deciding right now in hotseat games). */
  private viewerId = -1;
  private handOpen = false;
  private cinematic = true;
  private readonly el = {
    hud: byId('hud'),
    top: byId('topbar'),
    players: byId('players'),
    seats: byId('seatbar'),
    nowPlaying: byId('nowplaying'),
    story: byId('story'),
    turnCard: byId('turncard'),
    banner: byId('banner'),
    bar: byId('actionbar'),
    hand: byId('hand'),
    modal: byId('modal'),
    help: byId('help'),
    electionNight: byId('tvnight'),
    tooltip: byId('tooltip'),
  };
  private readonly history = new HistoryLog(byId('history'));

  constructor() {
    this.el.top.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      if (button.dataset.speed) {
        settings.speed = Number(button.dataset.speed);
        this.renderTop();
      } else if (button.id === 'btn-help') showHelp(this.el.help);
      else if (button.id === 'btn-history') this.history.show();
      else if (button.id === 'btn-sound') {
        sound.muted = !sound.muted;
        this.renderTop();
      } else if (button.id === 'btn-hand') {
        this.handOpen = !this.handOpen;
        this.refresh();
      } else if (button.id === 'btn-cam' && this.onToggleCamera) {
        this.cinematic = this.onToggleCamera();
        this.renderTop();
      } else if (
        button.id === 'btn-new' &&
        confirm(L('Abandon this game and start a new one?', 'Abandonar esta partida e começar uma nova?'))
      ) {
        location.reload();
      }
    });
    this.el.hand.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.hclose')) return;
      this.handOpen = false;
      this.refresh();
    });
  }

  /** Shows the HUD for a game. */
  attach(engine: Engine): void {
    this.engine = engine;
    this.viewerId = engine.players.find((p) => !p.isAI)?.id ?? -1;
    this.el.hud.classList.remove('hidden');
    this.refresh();
  }

  private get viewer(): Player | undefined {
    return this.engine?.players[this.viewerId];
  }

  /** Redraws the panels from the current game state. */
  refresh(): void {
    if (!this.engine) return;
    this.renderTop();
    this.el.players.innerHTML = playersHTML(this.engine, this.viewer);
    this.el.seats.innerHTML = seatBarHTML(this.engine);
    const viewer = this.viewer;
    this.el.hand.classList.toggle('hidden', !viewer || !this.handOpen);
    if (viewer && this.handOpen) this.el.hand.innerHTML = handHTML(viewer);
  }

  private renderTop(): void {
    if (this.engine) this.el.top.innerHTML = topBarHTML(this.engine, this.viewer, this.handOpen, this.cinematic);
  }

  /** Adds a line to the History log. */
  log(html: string, tone: Tone = 'info'): void {
    this.history.add(html, tone, this.engine?.year ?? 1);
  }

  /** A news story in the middle of the screen; resolves when the player clicks on (at once when fast-forwarding). */
  story(story: Story): Promise<void> {
    if (settings.fastForward) return Promise.resolve();
    return showStory(this.el.story, story, this.engine!, fastForwardSignal());
  }

  /** The big "NOW PLAYING" card at the start of a turn. */
  turnStart(playerId: number): Promise<void> {
    const p = this.engine!.players[playerId];
    this.setNow(playerId);
    if (settings.fastForward) return Promise.resolve();
    return showTurnCard(this.el.turnCard, p, this.engine!);
  }

  /** Updates the small "NOW PLAYING" label. */
  setNow(playerId: number): void {
    const p = this.engine!.players[playerId];
    this.el.nowPlaying.innerHTML = nowPlayingHTML(p);
    this.el.nowPlaying.style.setProperty('--pc', css(p.party.color));
    this.el.nowPlaying.classList.remove('hidden');
  }

  banner(title: string, text: string, tone: Tone = 'info'): Promise<void> {
    if (settings.fastForward) return Promise.resolve();
    return showBanner(this.el.banner, title, text, tone);
  }

  /** A decision for a human player; resolves with the chosen option's index (-1 if `signal` aborts it). */
  prompt(prompt: Prompt, signal?: AbortSignal): Promise<number> {
    const p = this.engine!.players[prompt.playerId];
    if (this.viewerId !== p.id) {
      // Hotseat: show the deciding player's own panel and hand.
      this.viewerId = p.id;
      this.refresh();
    }
    if (prompt.spin && this.armWheel)
      return showSpinPrompt(this.el.bar, prompt, p, this.armWheel, this.disarmWheel, signal);
    const humans = this.engine!.players.filter((q) => !q.isAI).length;
    return showPrompt({ bar: this.el.bar, modal: this.el.modal }, prompt, p, humans, signal);
  }

  /** After the opening deal, shows a human player their opening bills. */
  /** The yearly draft for a human: pick `count` of the offered bills (null if a fast-forward aborts it). */
  draft(prompt: Prompt, count: number, signal?: AbortSignal): Promise<number[] | null> {
    this.viewerId = prompt.playerId;
    this.refresh();
    return showDraft(this.el.modal, prompt, this.engine!.players[prompt.playerId], count, signal);
  }

  /** Presidential election night on TV (skipped while fast-forwarding). */
  presidentialNight(result: PresidentialResult): Promise<void> {
    if (settings.fastForward) return Promise.resolve();
    return showPresidentialNight(this.el.electionNight, result, this.engine!.players, fastForwardSignal());
  }

  /** Election night on TV (skipped while fast-forwarding: the result is in the History log). */
  electionNight(result: ElectionResult): Promise<void> {
    if (settings.fastForward) return Promise.resolve();
    return showElectionNight(this.el.electionNight, result, this.engine!.players, fastForwardSignal());
  }

  gameOver(result: GameResult): void {
    showGameOver(this.el.modal, result);
  }

  /** Square tooltip while hovering the board (`index` null hides it). */
  tooltip(index: number | null, x: number, y: number): void {
    const tip = this.el.tooltip;
    if (index === null) {
      tip.classList.add('hidden');
      return;
    }
    tip.innerHTML = squareTooltipHTML(index, this.engine);
    tip.style.left = `${Math.min(x + 16, window.innerWidth - 300)}px`;
    tip.style.top = `${Math.min(y + 16, window.innerHeight - 140)}px`;
    tip.classList.remove('hidden');
  }
}
