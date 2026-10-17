import { CRISIS_EVENTS, GLOBAL_CRISES, SUPER_CRISES } from '../../data/crises';
import { LOBBIES } from '../../data/lobbies';
import { MEDIA_EVENTS } from '../../data/mediaEvents';
import { MIDTERM_SQUARE, PRESIDENTIAL_SQUARE, SQUARE_META } from '../../data/squares';
import { L } from '../../i18n';
import { BOARD } from '../board';
import { buildDecks, Pile } from '../decks';
import * as R from '../rules';
import {
  type Axes,
  type Card,
  type Controller,
  type Player,
  type Prompt,
  type PromptOption,
  type Tone,
} from '../types';
import { doP, pn, pop, the, The } from './text';

import { committee } from './committee';
import { crisis, midterm } from './crisis';
import { debate } from './debate';
import { election, moodSwing, yearStartPerks } from './election';
import { coalitionVerdict, formGovernment, openingSeats } from './government';
import { legislature } from './legislature';
import { lobby } from './lobby';
import { media } from './media';
import { presidentialElection } from './presidency';
import { shortcut } from './shortcut';
import type { GameResult, GameView, PlayerSetup, ScoreRow, Story } from './view';

export interface MenuEntry {
  opt: PromptOption;
  run?: () => void | Promise<void>;
}

/**
 * The game: players, decks and the turn loop. Each square's rules live in their own module (legislature.ts,
 * media.ts, crisis.ts, …) as functions that receive the engine; the helpers at the bottom of this class
 * (tell, ask, menu, gainPop, gainCapital, …) are what those modules use to talk to players and the view.
 */
export class Engine {
  readonly players: Player[];
  // Player decks (cards go into hands) and face-up event decks.
  laws: Card[];
  lawDiscard: Card[] = [];
  strategy: Card[];
  strategyDiscard: Card[] = [];
  readonly crises = new Pile(CRISIS_EVENTS);
  readonly superCrises = new Pile(SUPER_CRISES);
  readonly globals = new Pile(GLOBAL_CRISES);
  readonly lobbies = new Pile(LOBBIES);
  readonly medias = new Pile(MEDIA_EVENTS);
  turn = 0;
  electionsHeld = 0;
  midtermYear = 0;
  /** Laws passed so far this year (for the Legislative MVP). */
  lawsThisYear: Card[] = [];
  /** The year the latest presidential election was held. */
  presidentialYear = 0;
  /** Vetoes each party has used this year (see R.vetoAllowance). */
  readonly vetoesUsed = new Map<number, number>();
  /** Times each coalition partner has voted against a coalition bill under the current government. */
  readonly rebellions = new Map<number, number>();
  over = false;
  readonly mood: Axes;
  result: GameResult | null = null;
  /** Called after every turn (the debug menu counts turns with it). */
  onTurnEnd?: () => void;
  /** Called as an election begins, before anything is shown (the debug menu can stop fast-forwarding here). */
  onElection?: (kind: 'presidential' | 'parliamentary') => void;

  constructor(
    setups: PlayerSetup[],
    private readonly controllers: Controller[],
    readonly view: GameView,
  ) {
    this.players = setups.map((s, id) => ({
      id,
      party: s.party,
      isAI: s.isAI,
      position: 0,
      waiting: false,
      popularity: R.START_POPULARITY,
      capital: R.START_CAPITAL,
      seats: 0,
      hand: [],
      portfolios: [],
      isPM: false,
      inGov: false,
      inOpp: false,
      isOppLeader: false,
      isPresident: false,
      stats: {
        pmYears: 0,
        cabinetYears: 0,
        billsPassed: 0,
        billsIntroduced: 0,
        electionWins: 0,
        presidencies: 0,
        mvps: 0,
      },
    }));
    const decks = buildDecks();
    this.laws = decks.laws;
    this.strategy = decks.strategy;
    const r = () => Math.round((2 + Math.random()) * 10) / 10;
    this.mood = { econ: r(), social: r(), env: r(), inst: r() };
  }

  get year() {
    return Math.min(this.electionsHeld + 1, R.YEARS);
  }

  get current() {
    return this.players[this.turn];
  }

  pm(): Player | undefined {
    return this.players.find((p) => p.isPM);
  }

  // ───────────────────────────── turn loop ─────────────────────────────

  async run(): Promise<void> {
    this.view.seatsChanged(); // nobody has a seat yet: the chamber starts empty
    await this.dealHands(1);
    this.view.log(
      L(
        '<b>Year 1 begins.</b> Every party spins for its share of the first parliament.',
        '<b>Começa o Ano 1.</b> Cada partido gira pela sua fatia do primeiro parlamento.',
      ),
      'turn',
    );
    await this.view.banner(
      'COALITION',
      L(
        'Year 1 begins — the wheel decides the first parliament. Who will form the first government?',
        'Começa o Ano 1 — a roleta decide o primeiro parlamento. Quem formará o primeiro governo?',
      ),
      'gov',
    );
    await openingSeats(this);
    await formGovernment(this);
    moodSwing(this);
    yearStartPerks(this);
    await coalitionVerdict(this);

    while (!this.over) {
      await this.takeTurn(this.current);
      this.onTurnEnd?.();
      if (this.over) break;
      this.turn = (this.turn + 1) % this.players.length;
    }
  }

  async takeTurn(p: Player): Promise<void> {
    // Parties that already reached the Election square sit out until everyone has arrived.
    if (p.waiting) {
      this.view.log(
        L(
          `${pn(p)} waits at the Election square for the other parties.`,
          `${pn(p)} espera na casa da Eleição pelos outros partidos.`,
        ),
      );
      return;
    }
    this.view.setActive(p.id);
    this.view.log(L(`— ${pn(p)}'s turn —`, `— Vez ${doP(p)} —`), 'turn');
    await this.view.turnStart(p.id);

    if (p.hand.length === 0) {
      this.draw(p, 1);
      this.view.log(L(`${pn(p)} has an empty hand and draws a card.`, `${pn(p)} está sem cartas e compra uma.`));
    }

    await this.ask(p, {
      title: L('Your turn', 'Sua vez'),
      body: L('Spin the roulette wheel to move around the board.', 'Gire a roleta para andar pelo tabuleiro.'),
      options: [{ label: L('🎡 Spin the Wheel', '🎡 Girar a Roleta'), ai: 1 }],
      spin: true,
      mode: 'bar',
    });
    const roll = 1 + Math.floor(Math.random() * 10);
    await this.view.spin(roll);
    const steps = Math.min(roll, R.BOARD_SIZE - p.position); // nobody moves past the Election square
    const dest = SQUARE_META[BOARD[(p.position + steps) % R.BOARD_SIZE]];
    this.view.log(
      L(
        `${pn(p)} rolls ${roll} and heads to the ${dest.icon} ${dest.name}.`,
        `${pn(p)} tira ${roll} e vai para ${dest.icon} ${dest.name}.`,
      ),
    );

    const arrived = await this.move(p, steps);
    if (this.over || arrived) return;
    await this.resolveSquare(p);
    if (this.over) return;
    this.view.refresh();
  }

  /** Moves a pawn. Returns true if it reached the Election square, which ends its year. */
  async move(p: Player, steps: number): Promise<boolean> {
    const from = p.position;
    await this.view.movePawn(p.id, from, steps);
    const raw = from + steps;
    p.position = raw % R.BOARD_SIZE;
    this.view.refresh();

    // The first party past the middle of the board each year sets off the Midterm crisis, then the
    // presidential election.
    if (from < MIDTERM_SQUARE && raw >= MIDTERM_SQUARE && this.midtermYear < this.year) {
      this.midtermYear = this.year;
      await midterm(this, p);
      if (this.over) return false;
    }
    if (from < PRESIDENTIAL_SQUARE && raw >= PRESIDENTIAL_SQUARE && this.presidentialYear < this.year) {
      this.presidentialYear = this.year;
      await presidentialElection(this, p);
      if (this.over) return false;
    }
    if (raw >= R.BOARD_SIZE) {
      await this.arriveAtElection(p);
      return true;
    }
    return false;
  }

  /** Moves a pawn back `steps` squares (never behind square 1: the year can't be undone). */
  async moveBack(p: Player, steps: number): Promise<void> {
    const back = Math.min(steps, p.position - 1);
    if (back <= 0) return;
    await this.view.movePawn(p.id, p.position, -back);
    p.position -= back;
    this.view.refresh();
  }

  /** A party reaches the Election square: it waits there; when the last party arrives, the nation votes. */
  async arriveAtElection(p: Player): Promise<void> {
    p.waiting = true;
    this.view.flashTile(0);
    const g = this.gainCapital(p, 2);
    const still = this.players.filter((q) => !q.waiting);
    if (still.length) {
      const road = still.map((q) => `${the(q)} (${L('square', 'casa')} ${q.position})`).join(', ');
      await this.tell(
        p,
        L('reached the Election square', 'chegou à casa da Eleição'),
        L(
          `${The(p)}'s year is over: it holds an election-night fundraiser (+${g} ⭐) and <b>waits here</b> until every party has arrived. Still on the road: ${road}.`,
          `O ano ${doP(p)} acabou: o partido faz um jantar de arrecadação (+${g} ⭐) e <b>espera aqui</b> até todos os partidos chegarem. Ainda a caminho: ${road}.`,
        ),
        'event',
      );
      return;
    }
    await this.tell(
      p,
      L('was the last party to reach the Election square', 'foi o último partido a chegar à casa da Eleição'),
      L(
        `Every party has finished the year (+${g} ⭐ fundraiser for ${the(p)}). The nation now goes to the polls.`,
        `Todos os partidos terminaram o ano (+${g} ⭐ de arrecadação para ${the(p)}). Agora o país vai às urnas.`,
      ),
      'event',
    );
    await election(this, p);
    for (const q of this.players) q.waiting = false;
    this.view.refresh();
  }

  /** Plays the square a party stands on. `viaShortcut`: it got here from a Fast Track / Red Tape square. */
  async resolveSquare(p: Player, viaShortcut = false): Promise<void> {
    const type = BOARD[p.position];
    this.view.flashTile(p.position);
    switch (type) {
      case 'advance':
      case 'retreat':
        // Shortcuts don't chain: landing on one from another just ends the move there.
        if (!viaShortcut) await shortcut(this, p, type === 'advance' ? 3 : -3);
        break;
      case 'formation':
        if (p.inGov) {
          this.gainCapital(p, 2);
          await this.tell(
            p,
            L('attended the cabinet briefing', 'participou da reunião do gabinete'),
            L(
              `As a governing party, ${the(p)} gains 2 ⭐ Political Capital.`,
              `Como partido do governo, ${the(p)} ganha 2 ⭐ de Capital Político.`,
            ),
            'gov',
          );
        } else if (R.isIndependent(p)) {
          const got = this.gainPop(p, 2);
          await this.tell(
            p,
            L('kept out of the government–opposition fight', 'ficou fora da briga entre governo e oposição'),
            L(
              `Voters like an independent voice: ${pop(got)} for ${the(p)}.`,
              `Os eleitores gostam de uma voz independente: ${pop(got)} para ${the(p)}.`,
            ),
            'good',
          );
        } else {
          if (this.draw(p, 1).length) await this.view.drawCard('strategy', p.id);
          await this.tell(
            p,
            L('studied the government programme', 'estudou o programa do governo'),
            L(
              'From the opposition benches the party draws a new STRATEGY card to plan its next attack.',
              'Dos bancos da oposição, o partido compra uma nova carta de ESTRATÉGIA para planejar o próximo ataque.',
            ),
            'info',
          );
        }
        break;
      case 'midterm': {
        const got = this.gainPop(p, 4);
        const g = this.gainCapital(p, 2);
        await this.tell(
          p,
          L('held a rousing party convention', 'fez uma convenção partidária empolgante'),
          L(
            `Members are fired up: ${pop(got)} and ${g} ⭐ Political Capital.`,
            `A militância está animada: ${pop(got)} e ${g} ⭐ de Capital Político.`,
          ),
          'good',
        );
        break;
      }
      case 'presidential': {
        const g = this.gainCapital(p, 2);
        await this.tell(
          p,
          L('was received at the presidential palace', 'foi recebido no palácio presidencial'),
          L(
            `An audience with the President is good for business: ${g} ⭐ Political Capital.`,
            `Uma audiência com o Presidente é boa para os negócios: ${g} ⭐ de Capital Político.`,
          ),
          'good',
        );
        break;
      }
      case 'debate':
        await debate(this, p);
        break;
      case 'legislature':
        await legislature(this, p);
        break;
      case 'media':
        await media(this, p);
        break;
      case 'crisis':
        await crisis(this, p);
        break;
      case 'lobby':
        await lobby(this, p);
        break;
      case 'committee':
        await committee(this, p);
        break;
    }
    this.view.refresh();
  }

  // ───────────────────────────── scoring ─────────────────────────────

  /** Governance Score: the tiebreak between parties with the same number of points. */
  governance(q: Player): number {
    const s = q.stats;
    return s.pmYears * 15 + s.cabinetYears * 6 + s.billsPassed * 8 + q.seats;
  }

  /** Overall standings: most elections won, then Governance Score. */
  standings(): Player[] {
    return [...this.players].sort(
      (a, b) => R.points(b.stats) - R.points(a.stats) || this.governance(b) - this.governance(a) || a.id - b.id,
    );
  }

  finish(kind: GameResult['kind'], winner?: Player): void {
    const rows: ScoreRow[] = this.standings().map((q) => {
      const s = q.stats;
      return {
        player: q,
        points: R.points(s),
        score: this.governance(q),
        detail: L(
          `${s.pmYears} yrs leading Congress ×15 · ${s.cabinetYears} cabinet yrs ×6 · ${s.billsPassed} laws passed ×8 · ${q.seats} seats`,
          `${s.pmYears} anos liderando o Congresso ×15 · ${s.cabinetYears} anos no gabinete ×6 · ${s.billsPassed} leis aprovadas ×8 · ${q.seats} cadeiras`,
        ),
      };
    });
    this.result = { kind, winner: winner ?? rows[0].player, rows };
    this.over = true;
    this.view.log(
      L(`<b>GAME OVER.</b> ${pn(this.result.winner)} wins!`, `<b>FIM DE JOGO.</b> ${pn(this.result.winner)} vence!`),
      'event',
    );
    this.view.gameOver(this.result);
  }

  // ───────────────────────────── helpers used by the rule modules ─────────────────────────────

  /** "Today, the <party> <did>." / "This means …" — shown centre-screen, and kept in the history log. */
  async tell(p: Player, did: string, meaning: string, tone: Tone, extra: Partial<Story> = {}): Promise<void> {
    const headline = L(`Today, ${the(p)} ${did}.`, `Hoje, ${the(p)} ${did}.`);
    this.view.log(`${headline} ${meaning}`, tone);
    this.view.refresh();
    await this.view.story({ actorId: p.id, headline, meaning, tone, ...extra });
  }

  ask(p: Player, prompt: Omit<Prompt, 'playerId'>): Promise<number> {
    return this.controllers[p.id].choose({ ...prompt, playerId: p.id });
  }

  /** Asks a party to pick exactly `count` options; returns their indices. */
  askMany(p: Player, prompt: Omit<Prompt, 'playerId'>, count: number): Promise<number[]> {
    return this.controllers[p.id].chooseMany({ ...prompt, playerId: p.id }, count);
  }

  async menu(
    p: Player,
    title: string,
    body: string,
    entries: MenuEntry[],
    extra: Partial<Prompt> = {},
  ): Promise<number> {
    const i = await this.ask(p, { title, body, options: entries.map((e) => e.opt), ...extra });
    await entries[i].run?.();
    this.view.refresh();
    return i;
  }

  /** Applies a popularity change, scaled by approval saturation (see R.scalePopularity). Returns the actual change. */
  gainPop(p: Player, amt: number): number {
    const before = p.popularity;
    let change = R.scalePopularity(amt, p.popularity);
    if (change > 0) {
      // The press watches the front-runner: the most popular party's gains are cut.
      if (this.isFrontRunner(p)) change = Math.max(1, Math.round(change * R.LEADER_GAIN_MULT));
    }
    p.popularity = R.clamp(p.popularity + change, 0, 100);
    const got = p.popularity - before;
    if (got) this.view.popChanged(p.id, got);
    return got;
  }

  /** Adds ⭐ Political Capital; the Minister of Economy earns +1 on every income. Returns the amount gained. */
  gainCapital(p: Player, amt: number): number {
    if (amt > 0 && p.portfolios.includes('economy')) amt += 1;
    p.capital = Math.max(0, p.capital + amt);
    return amt;
  }

  /** Alone at the top of the popularity ranking (a tie for first doesn't count). Under leader scrutiny. */
  isFrontRunner(p: Player): boolean {
    return this.players.every((q) => q === p || q.popularity < p.popularity);
  }

  isLeader(p: Player): boolean {
    return p.popularity >= Math.max(...this.players.map((q) => q.popularity));
  }

  removeCard(p: Player, c: Card): void {
    const i = p.hand.indexOf(c);
    if (i >= 0) p.hand.splice(i, 1);
    (c.kind === 'bill' ? this.lawDiscard : this.strategyDiscard).push(c);
  }

  /** Vetoes a party has left this year. */
  vetoesLeft(p: Player): number {
    return R.vetoAllowance(p) - (this.vetoesUsed.get(p.id) ?? 0);
  }

  /** Deals every party a fresh hand of policy bills from the LAW deck (at the start of each year). */
  async dealHands(year: number): Promise<void> {
    // The draft: every party is offered DRAFT_OFFER bills and keeps START_HAND; the rest go back to the discards.
    const offers = this.players.map(() => {
      const offer: Card[] = [];
      for (let i = 0; i < R.DRAFT_OFFER; i++) {
        const c = this.drawOne('law');
        if (c) offer.push(c);
      }
      return offer;
    });
    await this.view.dealHands(R.DRAFT_OFFER, year);
    for (const p of this.players) {
      const offer = offers[p.id];
      const keep = new Set(
        await this.askMany(
          p,
          {
            title:
              year > 1
                ? L(`Draft your bills for Year ${year}`, `Escolha seus projetos do Ano ${year}`)
                : L('Draft your opening bills', 'Escolha seus projetos iniciais'),
            body: L(
              `Keep <b>${R.START_HAND}</b> of these ${offer.length} bills; the rest go back to the LAW deck. Bills in <b style="color:var(--good)">green</b> match your ideology and win you popularity if they become law; bills in <b style="color:var(--bad)">red</b> go against it.`,
              `Fique com <b>${R.START_HAND}</b> destes ${offer.length} projetos; os outros voltam ao baralho de LEIS. Projetos em <b style="color:var(--good)">verde</b> combinam com sua ideologia e rendem popularidade se virarem lei; projetos em <b style="color:var(--bad)">vermelho</b> vão contra ela.`,
            ),
            options: offer.map((c) => ({ label: c.name, card: c, ai: this.cardValue(p, c) })),
          },
          R.START_HAND,
        ),
      );
      offer.forEach((c, i) => (keep.has(i) ? p.hand.push(c) : this.lawDiscard.push(c)));
    }
    this.view.refresh();
  }

  /** Top card of the LAW or STRATEGY deck (reshuffling its discard pile when empty). */
  drawOne(kind: 'law' | 'strategy'): Card | undefined {
    if (kind === 'law') {
      if (!this.laws.length) [this.laws, this.lawDiscard] = [R.shuffle(this.lawDiscard), []];
      return this.laws.pop();
    }
    if (!this.strategy.length) [this.strategy, this.strategyDiscard] = [R.shuffle(this.strategyDiscard), []];
    return this.strategy.pop();
  }

  /** Draw from the STRATEGY deck into a hand (respecting the hand limit). */
  draw(p: Player, n: number): Card[] {
    const got: Card[] = [];
    for (let i = 0; i < n && p.hand.length < R.HAND_LIMIT; i++) {
      const c = this.drawOne('strategy');
      if (!c) break;
      p.hand.push(c);
      got.push(c);
    }
    return got;
  }

  cardValue(p: Player, c: Card): number {
    switch (c.kind) {
      case 'bill':
        return R.billDelta(p.party.axes, c.target!) * 0.6;
      case 'scandal':
        return 4;
      case 'rally':
        return 3;
      case 'whip':
        return 2;
      case 'reaction':
        return 4;
      case 'noconfidence':
        return p.inGov ? 0.5 : 3;
    }
  }
}
