import { BOARD, SQUARE_META } from '../core/board';
import { KIND_LABEL } from '../core/cards';
import type { ElectionResult, Engine, GameResult, Story } from '../core/engine';
import { L } from '../core/i18n';
import * as R from '../core/rules';
import { paced, settings, sleep } from '../core/settings';
import { AXIS_INFO, AXIS_KEYS, PORTFOLIO_INFO, type Card, type EventCardView, type Player, type Prompt, type Tone } from '../core/types';

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const $ = (id: string) => document.getElementById(id)!;

export function cardHTML(c: Card, viewer?: Player): string {
  let body = `<div class="cflav">${c.text}</div>`;
  let foot = '';
  if (c.kind === 'bill' && c.target) {
    const chips = AXIS_KEYS.filter((k) => c.target![k] !== undefined)
      .map((k) => `<span class="chip">${R.poleName(k, c.target![k]!)}</span>`)
      .join('');
    body = `<div class="chips">${chips}</div>${body}`;
    if (viewer) {
      const d = R.billDelta(viewer.party.axes, c.target);
      foot = `<div class="cfoot ${d > 0 ? 'pos' : 'neg'}">${R.fmt(d)} ${L('popularity', 'de popularidade')}</div>`;
    }
  } else if (c.kind === 'scandal') foot = `<div class="cfoot neg">${L('Rival', 'Rival')} −${c.power}</div>`;
  else if (c.kind === 'rally') foot = `<div class="cfoot pos">${c.cost} ⭐ → +${c.power}</div>`;
  return `<div class="card k-${c.kind}"><div class="ckind">${KIND_LABEL[c.kind]}</div><div class="cname">${c.name}</div>${body}${foot}</div>`;
}

function eventHTML(ev: EventCardView): string {
  return `<div class="evcard t-${ev.tone}">
    <div class="evsub">${ev.subtitle}</div>
    <div class="evtitle">${ev.title}</div>
    <div class="evflav">${ev.flavor}</div>
    <div class="evtext">${ev.text}</div>
  </div>`;
}

/** HTML overlay: top bar, party panels, parliament bar, log, hand, prompts and banners. */
export class Hud {
  private engine!: Engine;
  private focusId = -1;
  private readonly top = $('topbar');
  private readonly playersEl = $('players');
  private readonly seatEl = $('seatbar');
  private readonly storyEl = $('story');
  private readonly turnEl = $('turncard');
  private readonly nowEl = $('nowplaying');
  private readonly historyEl = $('history');
  private history: { html: string; tone: Tone; year: number }[] = [];
  private handOpen = false;
  private readonly handEl = $('hand');
  private readonly bar = $('actionbar');
  private readonly modal = $('modal');
  private readonly bannerEl = $('banner');
  private readonly tip = $('tooltip');

  constructor() {
    this.top.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.dataset.speed) {
        settings.speed = Number(t.dataset.speed);
        this.renderTop();
      } else if (t.id === 'btn-help') this.showHelp();
      else if (t.id === 'btn-history') this.showHistory();
      else if (t.id === 'btn-hand') {
        this.handOpen = !this.handOpen;
        this.refresh();
      } else if (t.id === 'btn-cam' && this.onToggleCamera) {
        this.cameraOn = this.onToggleCamera();
        this.renderTop();
      } else if (t.id === 'btn-new' && confirm(L('Abandon this game and start a new one?', 'Abandonar esta partida e começar uma nova?'))) location.reload();
    });
    this.handEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.hclose')) {
        this.handOpen = false;
        this.refresh();
      }
    });
    this.historyEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#closehistory')) this.historyEl.classList.add('hidden');
    });
  }

  /** Toggles the cinematic camera; returns the new state. */
  onToggleCamera?: () => boolean;
  private cameraOn = true;

  attach(engine: Engine): void {
    this.engine = engine;
    this.focusId = engine.players.find((p) => !p.isAI)?.id ?? -1;
    $('hud').classList.remove('hidden');
    this.refresh();
  }

  refresh(): void {
    if (!this.engine) return;
    this.renderTop();
    this.renderPlayers();
    this.renderSeats();
    this.renderHand();
  }

  /** Everything that happens is kept in the History log (📜 button). */
  log(html: string, tone: Tone = 'info'): void {
    this.history.push({ html, tone, year: this.engine?.year ?? 1 });
    if (this.history.length > 400) this.history.shift();
    if (!this.historyEl.classList.contains('hidden')) this.showHistory();
  }

  /**
   * A news window in the centre of the screen: "Today, the … decided to …" and "This means …".
   * It stays until the player clicks (or presses Space/Enter): there is no timeout.
   */
  story(s: Story): Promise<void> {
    const actor = s.actorId !== undefined ? this.engine.players[s.actorId] : undefined;
    const accent = actor ? css(actor.party.color) : '#e8c35a';
    const tag = {
      event: L('BREAKING NEWS', 'PLANTÃO'),
      gov: L('GOVERNMENT', 'GOVERNO'),
      bad: L('SETBACK', 'REVÉS'),
      good: L('GOOD NEWS', 'BOAS NOTÍCIAS'),
      info: L('TODAY', 'HOJE'),
      turn: L('TODAY', 'HOJE'),
    }[s.tone];
    const side = s.event ? eventHTML(s.event) : s.card ? `<div class="stcard">${cardHTML(s.card)}</div>` : '';
    this.storyEl.innerHTML = `<div class="story t-${s.tone} ${side ? 'withside' : ''}" style="--ac:${accent}">
      <div class="sthead"><span class="live">● ${L('LIVE', 'AO VIVO')}</span><span class="net">${L('COALITION NEWS NETWORK', 'REDE COALIZÃO DE NOTÍCIAS')}</span><span class="sttag">${tag}</span><span class="nyr">${L('YEAR', 'ANO')} ${this.engine.year}</span></div>
      <div class="stbody">
        ${side ? `<div class="stside">${side}</div>` : ''}
        <div class="stmain">
          ${actor ? `<div class="stwho"><span class="emb">${actor.party.icon}</span>${actor.party.name}${actor.isAI ? ` · ${L('AI', 'IA')}` : ''}</div>` : ''}
          <div class="sthl">${s.headline}</div>
          <div class="stmeans"><span class="stlabel">${L('THIS MEANS', 'O QUE ISSO SIGNIFICA')}</span>${s.meaning}</div>
        </div>
      </div>
      <div class="stfoot"><button class="stnext">${L('Continue ▶', 'Continuar ▶')}</button><span>${L('or press Space', 'ou aperte Espaço')}</span></div>
    </div>`;
    this.storyEl.classList.remove('hidden');
    // Ignore input for a moment so a click meant for the previous window doesn't skip this one.
    const openedAt = performance.now();
    return new Promise((resolve) => {
      const close = () => {
        if (performance.now() - openedAt < 350) return;
        this.storyEl.removeEventListener('click', close);
        window.removeEventListener('keydown', onKey);
        this.storyEl.classList.add('hidden');
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
          e.preventDefault();
          close();
        }
      };
      this.storyEl.addEventListener('click', close);
      window.addEventListener('keydown', onKey);
    });
  }

  /** Big "now playing" card at the start of a turn. */
  async turnStart(playerId: number): Promise<void> {
    const p = this.engine.players[playerId];
    const humans = this.engine.players.filter((q) => !q.isAI).length;
    const who = p.isAI
      ? L('🤖 AI party', '🤖 Partido da IA')
      : humans > 1
        ? L('🧑 Human player — your turn', '🧑 Jogador humano — sua vez')
        : L('🧑 Your turn', '🧑 Sua vez');
    this.turnEl.innerHTML = `<div class="tc" style="--pc:${css(p.party.color)}">
      <div class="tclabel">${L('NOW PLAYING', 'JOGANDO AGORA')}</div>
      <div class="tcicon">${p.party.icon}</div><div class="tcname">${p.party.name}</div>
      <div class="tcsub">${who} · ${L('Year', 'Ano')} ${this.engine.year}</div>
    </div>`;
    this.turnEl.classList.remove('hidden');
    this.renderNow(p);
    await sleep(paced(p.isAI ? 1900 : 1400));
    this.turnEl.classList.add('hidden');
  }

  /** After the deal: a human player's 7 opening bills fan in one by one. Waits for a click. */
  showOpeningHand(playerId: number): Promise<void> {
    const p = this.engine.players[playerId];
    this.focusId = p.id;
    this.refresh();
    const cards = p.hand
      .map((c, i) => `<div class="dealt" style="animation-delay:${i * 0.12}s">${cardHTML(c, p)}</div>`)
      .join('');
    this.modal.innerHTML = `<div class="pr pdialog openinghand" style="--pc:${css(p.party.color)}">
      <div class="prwho">${p.party.icon} ${p.party.name}</div>
      <div class="prtitle">${L(`Your opening hand: ${p.hand.length} policy bills`, `Sua mão inicial: ${p.hand.length} projetos de lei`)}</div>
      <div class="prbody">${L(
        'These are the laws you can put before parliament. Bills in <b style="color:var(--good)">green</b> match your ideology and will win you popularity; bills in <b style="color:var(--bad)">red</b> go against it. Every Legislature square adds a new bill from the LAW deck, and you must introduce one.',
        'Estas são as leis que você pode levar ao plenário. Projetos em <b style="color:var(--good)">verde</b> combinam com sua ideologia e rendem popularidade; projetos em <b style="color:var(--bad)">vermelho</b> vão contra ela. Cada casa de Plenário adiciona um novo projeto do baralho de LEIS, e você deve apresentar um.',
      )}</div>
      <div class="dealhand">${cards}</div>
      <div class="opts"><button class="opt primary" id="takeseat"><span class="ol">${L('Take your seat in parliament ▶', 'Assumir sua cadeira no parlamento ▶')}</span></button></div>
    </div>`;
    this.modal.classList.remove('hidden');
    return new Promise((resolve) => {
      $('takeseat').addEventListener('click', () => {
        this.modal.classList.add('hidden');
        this.modal.innerHTML = '';
        resolve();
      });
    });
  }

  /** Update the persistent "NOW PLAYING" label. */
  setNow(playerId: number): void {
    this.renderNow(this.engine.players[playerId]);
  }

  private renderNow(p: Player): void {
    this.nowEl.innerHTML = `<span class="nplabel">${L('NOW PLAYING', 'JOGANDO AGORA')}</span><span class="npname" style="color:${css(p.party.color)}">${p.party.icon} ${p.party.name}</span>${p.isAI ? `<span class="npai">${L('AI', 'IA')}</span>` : ''}`;
    this.nowEl.style.setProperty('--pc', css(p.party.color));
    this.nowEl.classList.remove('hidden');
  }

  showHistory(): void {
    const rows = [...this.history]
      .reverse()
      .filter((h) => h.tone !== 'turn' || h.html.startsWith('<b>'))
      .map((h) => `<div class="hi t-${h.tone}"><span class="hy">${L('Y', 'A')}${h.year}</span>${h.html}</div>`)
      .join('');
    this.historyEl.innerHTML = `<div class="pr pdialog historybox">
      <div class="prtitle">📜 ${L('History', 'Histórico')}</div>
      <div class="hlist">${rows || `<div class="muted">${L('Nothing has happened yet.', 'Nada aconteceu ainda.')}</div>`}</div>
      <div class="opts"><button class="opt primary" id="closehistory"><span class="ol">${L('Close', 'Fechar')}</span></button></div>
    </div>`;
    this.historyEl.classList.remove('hidden');
  }

  // ───────────────────────────── panels ─────────────────────────────

  private renderTop(): void {
    const e = this.engine;
    const mood = AXIS_KEYS.map((k) => {
      const v = e.mood[k];
      return `<div class="maxis" title="${AXIS_INFO[k].name}: ${AXIS_INFO[k].low} ← ${v.toFixed(1)} → ${AXIS_INFO[k].high}">
        <span>${AXIS_INFO[k].name.slice(0, 4)}</span><div class="mtrack"><i style="left:${((v - 1) / 3) * 100}%"></i></div></div>`;
    }).join('');
    const moodTip = L(
      'Public Mood: where the median voter stands. Being close to it earns popularity at elections and wins debates.',
      'Humor do Eleitorado: onde está o eleitor médio. Ficar perto dele rende popularidade nas eleições e vence debates.',
    );
    const camTip = L(
      'Cinematic camera follows the action (drag to look around; it resumes after a few seconds)',
      'A câmera cinematográfica acompanha a ação (arraste para olhar em volta; ela volta depois de alguns segundos)',
    );
    this.top.innerHTML = `
      <div class="logo">${L('COALITION', 'COALIZÃO')}</div>
      <div class="yr">${L('Year', 'Ano')} <b>${e.year}</b>/${R.YEARS}</div>
      <div class="mood" title="${moodTip}"><span class="mlabel">${L('Public Mood', 'Humor do Eleitorado')}</span>${mood}</div>
      <div class="spacer"></div>
      <div class="speed" title="${L('Game speed', 'Velocidade do jogo')}">${[1, 2, 4].map((s) => `<button data-speed="${s}" class="${settings.speed === s ? 'on' : ''}">${s}×</button>`).join('')}</div>
      <button id="btn-cam" class="${this.cameraOn ? 'on' : ''}" title="${camTip}">🎥 ${this.cameraOn ? L('Cinematic', 'Cinematográfica') : L('Free cam', 'Câmera livre')}</button>
      ${this.engine.players[this.focusId] ? `<button id="btn-hand" class="${this.handOpen ? 'on' : ''}" title="${L('Show or hide your cards', 'Mostrar ou esconder suas cartas')}">🃏 ${L('Hand', 'Mão')} <b>${this.engine.players[this.focusId].hand.length}</b></button>` : ''}
      <button id="btn-history">📜 ${L('History', 'Histórico')}</button>
      <button id="btn-help">${L('Rules', 'Regras')}</button>
      <button id="btn-new">${L('New Game', 'Novo Jogo')}</button>`;
  }

  private renderPlayers(): void {
    const e = this.engine;
    const humans = e.players.filter((p) => !p.isAI).length;
    const ranked = [...e.players].sort((a, b) => b.popularity - a.popularity || b.seats - a.seats || a.id - b.id);
    const rankOf = (p: Player) => ranked.indexOf(p) + 1;
    const rolesOf = (p: Player) => {
      const roles: string[] = [];
      if (p.waiting) roles.push(`<span class="badge opp">⏳ ${L('Waiting at the Election', 'Esperando na Eleição')}</span>`);
      if (p.isPM) roles.push(`<span class="badge pm">👑 ${L('Prime Minister', 'Primeiro-Ministro')}</span>`);
      for (const pf of p.portfolios) roles.push(`<span class="badge min" title="${PORTFOLIO_INFO[pf].title}: ${PORTFOLIO_INFO[pf].perk}">${PORTFOLIO_INFO[pf].icon} ${PORTFOLIO_INFO[pf].short}</span>`);
      if (!p.inGov) roles.push(`<span class="badge opp">${L('Opposition', 'Oposição')}</span>`);
      return roles.join('');
    };
    const axesOf = (p: Player) => AXIS_KEYS.map((k) => `${AXIS_INFO[k].name}: ${R.poleName(k, p.party.axes[k])} (${p.party.axes[k]})`).join('\n');
    const popLabel = L('Popularity', 'Popularidade');

    // The human's own party gets a big panel, shown at its place in the popularity ranking.
    const mine = e.players[this.focusId];
    const myCard = mine
      ? `<div class="pcard mine ${mine.id === e.turn ? 'active' : ''}" style="--pc:${css(mine.party.color)}" title="${axesOf(mine)}">
          <div class="mytop">
            <div class="myemblem">${mine.party.icon}</div>
            <div class="myid">
              <div class="mylabel">${humans > 1 ? L('NOW DECIDING', 'DECIDINDO AGORA') : L('YOUR PARTY', 'SEU PARTIDO')} · <span class="rank r${rankOf(mine)}">#${rankOf(mine)}</span></div>
              <div class="myname">${mine.party.name}</div>
              <div class="mytag">${mine.party.tagline}</div>
            </div>
          </div>
          <div class="roles">${rolesOf(mine)}</div>
          <div class="popbar big"><div style="width:${mine.popularity}%"></div><span>${popLabel} <b>${mine.popularity}</b></span></div>
          <div class="mystats">
            <div title="${L('Parliamentary seats', 'Cadeiras no parlamento')}"><b>${mine.seats}</b><span>🪑 ${L('Seats', 'Cadeiras')}</span></div>
            <div title="${L('Laws passed', 'Leis aprovadas')}"><b>${mine.stats.billsPassed}</b><span>📜 ${L('Laws', 'Leis')}</span></div>
            <div title="${L('Political Capital: earned from lobbies, laws and office; spent on rallies, vetoes, whips and crisis fixes', 'Capital Político: vem de lobbies, leis e cargos; é gasto em comícios, vetos, pressão na bancada e crises')}" class="cap"><b>${mine.capital}</b><span>⭐ ${L('Capital', 'Capital')}</span></div>
          </div>
        </div>`
      : '';
    this.playersEl.innerHTML = ranked
      .map((p) => {
        if (p === mine) return myCard;
        const rank = rankOf(p) - 1;
        const roles = rolesOf(p);
        const axes = axesOf(p);
        const tag = p.isAI ? L('AI', 'IA') : humans > 1 ? L('HUMAN', 'HUMANO') : L('YOU', 'VOCÊ');
        return `<div class="pcard ${p.id === e.turn ? 'active' : ''}" style="--pc:${css(p.party.color)}" title="${axes}">
          <div class="pcwm">${p.party.icon}</div>
          <div class="pchead"><span class="rank r${rank + 1}">#${rank + 1}</span><span class="pcicon">${p.party.icon}</span><span class="pcname">${p.party.name}</span><span class="who">${tag}</span></div>
          <div class="roles">${roles}</div>
          <div class="popbar"><div style="width:${p.popularity}%"></div><span>${popLabel} <b>${p.popularity}</b></span></div>
          <div class="stats">
            <span title="${L('Political Capital', 'Capital Político')}">⭐ ${p.capital}</span>
            <span title="${L('Parliamentary seats', 'Cadeiras no parlamento')}">🪑 ${p.seats}</span>
            <span title="${L('Laws passed', 'Leis aprovadas')}">📜 ${p.stats.billsPassed}</span>
            <span title="${L('Cards in hand', 'Cartas na mão')}">🃏 ${p.hand.length}</span>
          </div>
        </div>`;
      })
      .join('');
  }

  private renderSeats(): void {
    const e = this.engine;
    const order = R.benchOrder(e.players);
    const gov = e.players.filter((p) => p.inGov).reduce((s, p) => s + p.seats, 0);
    const segs = order
      .filter((p) => p.seats > 0)
      .map(
        (p) =>
          `<div class="seg ${p.inGov ? 'gov' : ''}" style="flex:${p.seats};background:${css(p.party.color)}" title="${p.party.name}: ${p.seats} ${L('seats', 'cadeiras')}${p.inGov ? L(' (government)', ' (governo)') : ''}">${p.seats >= 12 ? `${p.party.icon} ${p.party.short} ${p.seats}` : p.seats >= 6 ? p.party.icon : ''}</div>`,
      )
      .join('');
    this.seatEl.innerHTML = `<div class="sbar">${segs}<div class="maj" style="left:${((R.TOTAL_SEATS - R.MAJORITY) / R.TOTAL_SEATS) * 100}%"></div></div>
      <div class="slabel">◀ ${L('Opposition', 'Oposição')} <b>${R.TOTAL_SEATS - gov}</b> · ${L('Government', 'Governo')} <b>${gov}</b> ▶ · ${L('majority', 'maioria')} ${R.MAJORITY}</div>`;
  }

  /** The hand lives behind the 🃏 Hand button in the top bar; the drawer opens on demand. */
  private renderHand(): void {
    const p = this.engine.players[this.focusId];
    if (!p || !this.handOpen) {
      this.handEl.classList.add('hidden');
      return;
    }
    this.handEl.classList.remove('hidden');
    this.handEl.innerHTML = `<div class="hhead" style="color:${css(p.party.color)}">${p.party.name} — ${L('hand', 'mão')} (${p.hand.length})<button class="hclose">✕</button></div>
      <div class="hcards">${p.hand.map((c) => cardHTML(c, p)).join('') || `<div class="empty">${L('No cards', 'Sem cartas')}</div>`}</div>`;
  }

  // ───────────────────────────── prompts & overlays ─────────────────────────────

  /** Hooks into the 3D wheel: resolves when the player clicks it. */
  armWheel?: () => Promise<void>;
  disarmWheel?: () => void;

  /** A spin prompt: the player clicks the roulette wheel itself (Space/Enter also works). */
  private spinPrompt(pr: Prompt, p: Player): Promise<number> {
    return new Promise((resolve) => {
      this.bar.innerHTML = `<div class="pr pbar spinhint" style="--pc:${css(p.party.color)}">
        <div class="prwho">${p.party.icon} ${p.party.name}</div>
        <div class="prtitle">${pr.title}</div>
        <div class="spincta">🎡 ${L('<b>Click the wheel</b> to spin it <span>(or press Space)</span>', '<b>Clique na roleta</b> para girar <span>(ou aperte Espaço)</span>')}</div>
      </div>`;
      this.bar.classList.remove('hidden');
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', onKey);
        this.disarmWheel?.();
        this.bar.classList.add('hidden');
        this.bar.innerHTML = '';
        resolve(0);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          done();
        }
      };
      window.addEventListener('keydown', onKey);
      void this.armWheel!().then(done);
    });
  }

  prompt(pr: Prompt): Promise<number> {
    const p = this.engine.players[pr.playerId];
    if (this.focusId !== p.id) {
      this.focusId = p.id;
      this.refresh();
    }
    if (pr.spin && this.armWheel) return this.spinPrompt(pr, p);
    return new Promise((resolve) => {
      const bar = pr.mode === 'bar';
      const host = bar ? this.bar : this.modal;
      const hasCards = pr.options.some((o) => o.card);
      const opts = pr.options
        .map((o, i) => {
          const dis = o.disabled ? 'disabled' : '';
          if (o.card) {
            return `<button class="optcard" data-i="${i}" ${dis}>${cardHTML(o.card, p)}<span class="oclabel">${o.label}</span>${o.detail ? `<span class="od">${o.detail}</span>` : ''}${o.disabled ? `<span class="dis">${o.disabled}</span>` : ''}</button>`;
          }
          const style = o.color !== undefined ? `style="--oc:${css(o.color)}"` : '';
          return `<button class="opt ${bar && i === 0 ? 'primary' : ''} ${o.color !== undefined ? 'colored' : ''}" data-i="${i}" ${dis} ${style}>
            <span class="ol">${o.label}</span>${o.detail ? `<span class="od">${o.detail}</span>` : ''}${o.disabled ? `<span class="dis">${o.disabled}</span>` : ''}</button>`;
        })
        .join('');
      const who = `${p.party.icon} ${p.party.name}${this.engine.players.filter((q) => !q.isAI).length > 1 ? L(' — your decision', ' — sua decisão') : ''}`;
      if (pr.event && !bar) {
        // The drawn card itself, with its choices printed on it as buttons.
        const ev = pr.event;
        const cardOpts = pr.options
          .map((o, i) => {
            const dis = o.disabled ? 'disabled' : '';
            const style = o.color !== undefined ? `style="--oc:${css(o.color)}"` : '';
            return `<button class="cpopt ${o.color !== undefined ? 'colored' : ''}" data-i="${i}" ${dis} ${style}>
              <span class="ol">${o.card ? '🃏 ' : ''}${o.label}</span>${o.detail ? `<span class="od">${o.detail}</span>` : ''}${o.disabled ? `<span class="dis">${o.disabled}</span>` : ''}</button>`;
          })
          .join('');
        host.innerHTML = `<div class="pr cardprompt t-${ev.tone}" style="--pc:${css(p.party.color)}">
          <div class="cplabel">${ev.subtitle}</div>
          <div class="cpinner">
            <div class="cpwho">${who}</div>
            <div class="cptitle">${ev.title}</div>
            <div class="cpflav">${ev.flavor}</div>
            <div class="cptext">${ev.text}</div>
            ${pr.body ? `<div class="cpbody">${pr.body}</div>` : ''}
            <div class="cpq">${pr.title === ev.title ? L('What will you do?', 'O que você vai fazer?') : pr.title}</div>
            <div class="cpopts">${cardOpts}</div>
          </div>
        </div>`;
      } else {
        host.innerHTML = `<div class="pr ${bar ? 'pbar' : 'pdialog'}" style="--pc:${css(p.party.color)}">
          <div class="prwho">${who}</div>
          <div class="prtitle">${pr.title}</div>
          ${pr.event ? eventHTML(pr.event) : ''}
          ${pr.showCard ? `<div class="prcard">${cardHTML(pr.showCard, p)}</div>` : ''}
          ${pr.body ? `<div class="prbody">${pr.body}</div>` : ''}
          <div class="opts ${hasCards ? 'withcards' : ''}">${opts}</div>
        </div>`;
      }
      host.classList.remove('hidden');

      const done = (i: number) => {
        window.removeEventListener('keydown', onKey);
        host.classList.add('hidden');
        host.innerHTML = '';
        resolve(i);
      };
      const onKey = (e: KeyboardEvent) => {
        if (!bar || (e.code !== 'Space' && e.code !== 'Enter')) return;
        const i = pr.options.findIndex((o) => !o.disabled);
        if (i >= 0) {
          e.preventDefault();
          done(i);
        }
      };
      window.addEventListener('keydown', onKey);
      host.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) => b.addEventListener('click', () => done(Number(b.dataset.i))));
    });
  }

  async banner(title: string, text: string, tone: Tone = 'info'): Promise<void> {
    this.bannerEl.className = `t-${tone}`;
    this.bannerEl.innerHTML = `<div class="btitle">${title}</div><div class="btext">${text}</div>`;
    await sleep(paced(2300));
    this.bannerEl.className = 'hidden';
  }

  tooltip(index: number | null, x: number, y: number): void {
    if (index === null) {
      this.tip.classList.add('hidden');
      return;
    }
    const meta = SQUARE_META[BOARD[index]];
    const here = this.engine?.players.filter((p) => p.position === index).map((p) => `<b style="color:${css(p.party.color)}">${p.party.icon} ${p.party.short}</b>`) ?? [];
    this.tip.innerHTML = `<div class="tt">${meta.icon} ${index} · ${meta.name}</div><div>${meta.desc}</div>${here.length ? `<div class="th">${L('Here', 'Aqui')}: ${here.join(' ')}</div>` : ''}`;
    this.tip.style.left = `${Math.min(x + 16, window.innerWidth - 300)}px`;
    this.tip.style.top = `${Math.min(y + 16, window.innerHeight - 140)}px`;
    this.tip.classList.remove('hidden');
  }

  /**
   * Election night, TV style: votes count in live (ranked bars + a line chart of each party's share as the
   * count progresses), then the seat table shows who gained and who lost. Waits for the viewer to continue.
   */
  electionNight(r: ElectionResult): Promise<void> {
    const players = this.engine.players;
    const host = $('tvnight');
    const rows = r.rows.map((row) => ({ ...row, p: players[row.playerId] }));
    const winner = players[r.winnerId];
    const yMax = Math.min(100, Math.ceil((Math.max(...rows.map((x) => x.share)) + 12) / 10) * 10);
    const W = 600;
    const H = 260;
    const ticker = rows
      .slice()
      .sort((a, b) => b.share - a.share)
      .map((x) => `${x.p.party.icon} ${x.p.party.short} ${x.share.toFixed(1)}%`)
      .join('   ◆   ');

    host.innerHTML = `<div class="tv">
      <div class="tvtop">
        <span class="tvbreak">${L('BREAKING NEWS', 'PLANTÃO')}</span><span class="tvlive">● ${L('LIVE', 'AO VIVO')}</span>
        <span class="tvtitle">${L('ELECTION NIGHT', 'NOITE DA ELEIÇÃO')} · ${L('YEAR', 'ANO')} ${r.year}${r.final ? L(' · FINAL ELECTION', ' · ELEIÇÃO FINAL') : ''}</span>
        <span class="tvcount">${L('VOTES COUNTED', 'URNAS APURADAS')} <b id="tvpct">0%</b></span>
      </div>
      <div class="tvheadline" id="tvhead">${L('The polls have closed. The count is under way…', 'As urnas fecharam. A apuração começou…')}</div>
      <div class="tvmain">
        <div class="tvpanel"><div class="tvlabel">${L('VOTE SHARE', 'PERCENTUAL DE VOTOS')}</div><div class="tvbars" style="height:${rows.length * 46}px">
          ${rows
            .map(
              (x) => `<div class="tvrow" data-id="${x.playerId}" style="--pc:${css(x.p.party.color)}">
                <span class="tvname">${x.p.party.icon} ${x.p.party.short}</span>
                <span class="tvbar"><i></i></span><span class="tvval">0.0%</span></div>`,
            )
            .join('')}
        </div></div>
        <div class="tvpanel"><div class="tvlabel">${L('THE COUNT, AS IT HAPPENED', 'A APURAÇÃO, MINUTO A MINUTO')}</div>
          <svg class="tvchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            ${[0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" x2="${W}" y1="${H - f * H}" y2="${H - f * H}" class="grid"/><text x="4" y="${f === 1 ? 14 : H - f * H - 4}" class="gl">${Math.round(f * yMax)}%</text>`).join('')}
            ${rows.map((x) => `<polyline data-id="${x.playerId}" fill="none" stroke="${css(x.p.party.color)}" stroke-width="3.5" points=""/>`).join('')}
          </svg>
        </div>
      </div>
      <div class="tvseats hidden" id="tvseats"></div>
      <div class="tvfoot hidden" id="tvfoot">
        <div class="tvformula">${L(
          `<b>How seats are calculated:</b> each party's vote share is its popularity ÷ the total popularity of all parties (${Math.round(r.totalPopularity)}). Seats = vote share × ${R.TOTAL_SEATS}, rounded so they add up to exactly ${R.TOTAL_SEATS}. ${R.MAJORITY} seats is a majority.`,
          `<b>Como as cadeiras são calculadas:</b> o percentual de votos de cada partido é sua popularidade ÷ a popularidade total de todos os partidos (${Math.round(r.totalPopularity)}). Cadeiras = percentual × ${R.TOTAL_SEATS}, arredondado para somar exatamente ${R.TOTAL_SEATS}. ${R.MAJORITY} cadeiras formam maioria.`,
        )}</div>
        <button class="opt primary" id="tvgo"><span class="ol">${L('Continue ▶', 'Continuar ▶')}</span></button>
      </div>
      <div class="tvticker"><div class="tvtrack">${ticker}   ◆   ${ticker}   ◆   </div></div>
    </div>`;
    host.classList.remove('hidden');

    // Each party's share wobbles early in the count and settles on the final result.
    const wobble = rows.map(() => (Math.random() - 0.5) * 2);
    const shareAt = (t: number) => {
      const raw = rows.map((x, i) => Math.max(0.5, x.share + wobble[i] * 9 * Math.pow(1 - t, 1.3) + Math.sin(t * 14 + i * 2) * 2 * (1 - t)));
      const sum = raw.reduce((a, b) => a + b, 0);
      return raw.map((v) => (v / sum) * 100);
    };
    const pts: string[][] = rows.map(() => []);
    const lines = rows.map((x) => host.querySelector<SVGPolylineElement>(`polyline[data-id="${x.playerId}"]`)!);
    const rowEls = rows.map((x) => host.querySelector<HTMLElement>(`.tvrow[data-id="${x.playerId}"]`)!);
    const pctEl = $('tvpct');
    const dur = paced(7000);
    const start = performance.now();
    let lastSample = -1;

    return new Promise((resolve) => {
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const shares = t >= 1 ? rows.map((x) => x.share) : shareAt(t);
        pctEl.textContent = `${Math.round(t * 100)}%`;
        const order = shares.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
        order.forEach(({ v, i }, rank) => {
          const el = rowEls[i];
          el.style.top = `${rank * 46}px`;
          el.querySelector<HTMLElement>('i')!.style.width = `${(v / yMax) * 100}%`;
          el.querySelector<HTMLElement>('.tvval')!.textContent = `${v.toFixed(1)}%`;
        });
        const sample = Math.floor(t * 40);
        if (sample !== lastSample) {
          lastSample = sample;
          shares.forEach((v, i) => {
            pts[i].push(`${(t * W).toFixed(1)},${(H - (v / yMax) * H).toFixed(1)}`);
            lines[i].setAttribute('points', pts[i].join(' '));
          });
          const lead = rows[order[0].i].p;
          const leadName = `${lead.party.icon} <b style="color:${css(lead.party.color)}">${lead.party.name}</b>`;
          $('tvhead').innerHTML =
            t < 1 ? L(`${leadName} leads with ${order[0].v.toFixed(1)}% of the votes counted so far`, `${leadName} lidera com ${order[0].v.toFixed(1)}% dos votos apurados até agora`) : '';
        }
        if (t < 1) requestAnimationFrame(frame);
        else finish();
      };
      const finish = () => {
        const w = winner.stats.electionWins;
        const wName = `<b style="color:${css(winner.party.color)}">${winner.party.name}</b>`;
        const maj = winner.seats >= R.MAJORITY ? L(' — <b>ABSOLUTE MAJORITY!</b>', ' — <b>MAIORIA ABSOLUTA!</b>') : '';
        $('tvhead').innerHTML = L(
          `🏆 ${wName} wins the Year ${r.year} election — ${w} election win${w === 1 ? '' : 's'} so far${maj}`,
          `🏆 ${wName} vence a eleição do Ano ${r.year} — ${w} ${w === 1 ? 'vitória' : 'vitórias'} até agora${maj}`,
        );
        const seatRows = rows
          .slice()
          .sort((a, b) => b.seatsAfter - a.seatsAfter)
          .map((x) => {
            const d = x.seatsAfter - x.seatsBefore;
            const change =
              d > 0
                ? `<span class="chg up">▲ +${d} ${L('GAINED', 'GANHOU')}</span>`
                : d < 0
                  ? `<span class="chg down">▼ ${d} ${L('LOST', 'PERDEU')}</span>`
                  : `<span class="chg same">= ${L('NO CHANGE', 'SEM MUDANÇA')}</span>`;
            const exact = (x.share / 100) * R.TOTAL_SEATS;
            return `<div class="tvsr" style="--pc:${css(x.p.party.color)}">
              <span class="tvsname">${x.p.party.icon} ${x.p.party.name}</span>
              <span class="tvscalc">${Math.round(x.popularity)} pop${x.moodBonus ? ` (${R.fmt(x.moodBonus)} ${L('mood', 'humor')})` : ''} → ${x.share.toFixed(1)}% → ${exact.toFixed(1)}</span>
              <span class="tvsseats"><b>${x.seatsAfter}</b> ${L('seats', 'cadeiras')} <small>(${L('was', 'eram')} ${x.seatsBefore})</small></span>
              ${change}
            </div>`;
          })
          .join('');
        const seats = $('tvseats');
        seats.innerHTML = `<div class="tvlabel">${L('SEATS IN PARLIAMENT', 'CADEIRAS NO PARLAMENTO')}</div>${seatRows}`;
        setTimeout(() => {
          seats.classList.remove('hidden');
          $('tvfoot').classList.remove('hidden');
        }, paced(500));
        const done = () => {
          window.removeEventListener('keydown', onKey);
          host.classList.add('hidden');
          host.innerHTML = '';
          resolve();
        };
        const onKey = (e: KeyboardEvent) => {
          if ((e.code === 'Space' || e.code === 'Enter') && !$('tvfoot').classList.contains('hidden')) {
            e.preventDefault();
            done();
          }
        };
        window.addEventListener('keydown', onKey);
        $('tvgo').addEventListener('click', done);
      };
      requestAnimationFrame(frame);
    });
  }

  gameOver(r: GameResult): void {
    const rows = r.rows
      .map(
        (row, i) => `<tr><td>${i + 1}</td><td><b style="color:${css(row.player.party.color)}">${row.player.party.icon} ${row.player.party.name}</b></td>
          <td class="num">${row.wins}</td><td class="num2">${row.score}</td><td class="det">${row.detail}</td></tr>`,
      )
      .join('');
    const tie = r.rows.filter((x) => x.wins === r.rows[0].wins).length > 1;
    const how =
      r.kind === 'majority'
        ? L(`wins an <b>absolute parliamentary majority</b> with ${r.winner.seats} seats!`, `conquista a <b>maioria absoluta no parlamento</b> com ${r.winner.seats} cadeiras!`)
        : L(
            `wins the game by winning the most elections (${r.winner.stats.electionWins} of ${R.YEARS})${tie ? ', with the best Governance Score as the tiebreak' : ''}.`,
            `vence o jogo por ganhar mais eleições (${r.winner.stats.electionWins} de ${R.YEARS})${tie ? ', com a melhor Pontuação de Governo como desempate' : ''}.`,
          );
    this.modal.innerHTML = `<div class="pr pdialog gameover" style="--pc:${css(r.winner.party.color)}">
      <div class="prwho">${L('Game over', 'Fim de jogo')}</div>
      <div class="prtitle">🏆 ${r.winner.party.icon} ${r.winner.party.name}</div>
      <div class="prbody">${r.winner.party.name} ${how}</div>
      <table class="score"><thead><tr><th>#</th><th>${L('Party', 'Partido')}</th><th>🏆 ${L('Elections won', 'Eleições vencidas')}</th><th>${L('Governance', 'Governo')}</th><th>${L('Governance breakdown (tiebreak)', 'Detalhe da pontuação de governo (desempate)')}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="opts"><button class="opt primary" id="again"><span class="ol">${L('Play again', 'Jogar de novo')}</span></button></div>
    </div>`;
    this.modal.classList.remove('hidden');
    $('again').addEventListener('click', () => location.reload());
  }

  showHelp(): void {
    const help = $('help');
    const sq = (Object.keys(SQUARE_META) as (keyof typeof SQUARE_META)[])
      .map((k) => `<li><b>${SQUARE_META[k].icon} ${SQUARE_META[k].name}</b> — ${SQUARE_META[k].desc}</li>`)
      .join('');
    help.innerHTML = `<div class="pr pdialog help">
      <div class="prtitle">${L('How to play COALITION', 'Como jogar COALIZÃO')}</div>
      <div class="prbody">${L(
        `<p>Lead your party through <b>5 years</b> of politics. Each lap of the 50-square board is one year, climbing toward the
        Parliamentary Election at the summit. Spin the roulette (1–10) to move.</p>
        <p><b>Popularity</b> converts into the 150 seats of parliament at each election. <b>⭐ Political Capital</b> is your one currency:
        you earn it from lobbies, cabinet posts, committee reports and passing laws, and spend it on rallies, vetoes, whip votes, investigations and crisis fixes.</p>
        <p><b>Win</b> by taking 76+ seats alone in an election, or by <b>winning the most elections</b> (most seats each year) over 5 years.
        Ties are broken by the <b>Governance Score</b> (PM years ×15, cabinet years ×6, laws passed ×8, plus final seats).
        Popularity resets to 30 after every election, and bills only win popularity if they become law.</p>
        <p>When no party has 76 seats, the largest party negotiates a <b>coalition</b> by offering cabinet portfolios and ⭐ capital.
        Parties vote on bills by ideology; coalition partners back the Prime Minister's bills.</p>
        <p><b>Defense layers</b> against crises and scandals: your ideology (passive), reaction cards, spending ⭐ capital, and cabinet privileges.</p>`,
        `<p>Conduza seu partido por <b>5 anos</b> de política. Cada volta no tabuleiro de 50 casas é um ano, subindo rumo à
        Eleição Parlamentar no topo. Gire a roleta (1–10) para andar.</p>
        <p>A <b>popularidade</b> vira as 150 cadeiras do parlamento em cada eleição. O <b>⭐ Capital Político</b> é sua única moeda:
        você ganha com lobbies, ministérios, relatórios de comissão e leis aprovadas, e gasta em comícios, vetos, pressão na bancada, investigações e crises.</p>
        <p><b>Vença</b> conquistando 76+ cadeiras sozinho numa eleição, ou <b>vencendo mais eleições</b> (mais cadeiras a cada ano) ao longo de 5 anos.
        Empates são decididos pela <b>Pontuação de Governo</b> (anos como PM ×15, anos no gabinete ×6, leis aprovadas ×8, mais as cadeiras finais).
        A popularidade volta a 30 depois de cada eleição, e projetos só rendem popularidade se virarem lei.</p>
        <p>Quando nenhum partido tem 76 cadeiras, o maior partido negocia uma <b>coalizão</b> oferecendo ministérios e ⭐ capital.
        Os partidos votam nos projetos conforme a ideologia; os aliados da coalizão apoiam os projetos do Primeiro-Ministro.</p>
        <p><b>Camadas de defesa</b> contra crises e escândalos: sua ideologia (passiva), cartas de reação, gastar ⭐ capital e privilégios dos ministérios.</p>`,
      )}
        <ul class="sqlist">${sq}</ul>
        <p class="muted">${L(
          'Tip: the 🎥 cinematic camera follows the action; drag or scroll to look around yourself (it resumes after a few seconds), or switch to Free cam. Hover a square for details. Space/Enter confirms the action bar.',
          'Dica: a 🎥 câmera cinematográfica acompanha a ação; arraste ou role para olhar você mesmo (ela volta depois de alguns segundos), ou mude para Câmera livre. Passe o mouse sobre uma casa para ver detalhes. Espaço/Enter confirma a barra de ação.',
        )}</p>
      </div>
      <div class="opts"><button class="opt primary" id="closehelp"><span class="ol">${L('Close', 'Fechar')}</span></button></div>
    </div>`;
    help.classList.remove('hidden');
    $('closehelp').addEventListener('click', () => help.classList.add('hidden'));
  }
}
