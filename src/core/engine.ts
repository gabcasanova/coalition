import { BOARD, SQUARE_META } from './board';
import { buildDecks } from './cards';
import { CRISIS_EVENTS, GLOBAL_CRISES, LOBBIES, MEDIA_EVENTS, type EventDef, type LobbyDef, type MediaDef, type Mitigation } from './events';
import { aoArt, art, deArt, isPT, L } from './i18n';
import * as R from './rules';
import {
  AXIS_INFO,
  AXIS_KEYS,
  PORTFOLIOS,
  PORTFOLIO_INFO,
  type Axes,
  type Card,
  type CardFace,
  type Controller,
  type DeckKind,
  type EventCardView,
  type PartyDef,
  type Player,
  type Portfolio,
  type Prompt,
  type PromptOption,
  type Tone,
} from './types';

export interface PlayerSetup {
  party: PartyDef;
  isAI: boolean;
}

export interface ScoreRow {
  player: Player;
  /** Elections won: the main ranking. */
  wins: number;
  /** Governance Score: the tiebreak. */
  score: number;
  detail: string;
}

/** One party's line on election night. */
export interface ElectionRow {
  playerId: number;
  popularity: number;
  /** Vote share in percent: popularity ÷ total popularity. */
  share: number;
  seatsBefore: number;
  seatsAfter: number;
  /** Last-minute swing from the public mood (already included in popularity). */
  moodBonus: number;
}

export interface ElectionResult {
  year: number;
  final: boolean;
  /** Party with the most seats: it wins this year's election. */
  winnerId: number;
  totalPopularity: number;
  rows: ElectionRow[];
}

export interface GameResult {
  kind: 'majority' | 'prestige';
  winner: Player;
  rows: ScoreRow[];
}

/** A news story shown in the centre of the screen: what happened, and what it means. */
export interface Story {
  /** The party the story is about (colours the window), if any. */
  actorId?: number;
  /** "Today, the National Union decided to …" */
  headline: string;
  /** "This means …" */
  meaning: string;
  tone: Tone;
  event?: EventCardView;
  card?: Card;
}

/** Everything the engine needs from the presentation layer (3D scene + HUD). */
export interface GameView {
  refresh(): void;
  /** Minor detail for the history log. */
  log(html: string, tone?: Tone): void;
  /** Present a story and wait until the viewer has read it (or clicked on). */
  story(s: Story): Promise<void>;
  /** Deal the opening hands: cards fly from the LAW deck to every pawn; humans then see their bills. */
  dealOpening(perPlayer: number): Promise<void>;
  /** Big "now playing" announcement at the start of a turn. */
  turnStart(playerId: number): Promise<void>;
  setActive(playerId: number): void;
  spin(result: number): Promise<void>;
  /** Animate the player drawing a card from a deck; `face` reveals it to everyone, omitted = private draw. */
  drawCard(deck: DeckKind, playerId: number, face?: CardFace): Promise<void>;
  movePawn(playerId: number, from: number, steps: number): Promise<void>;
  flashTile(index: number): void;
  banner(title: string, text: string, tone?: Tone): Promise<void>;
  seatsChanged(): void;
  /** A new Prime Minister walks to their seat at the end of the chamber. */
  pmTakesSeat(playerId: number): Promise<void>;
  /** The opposition rises on its benches and its leader walks to their seat. */
  oppositionForms(leaderId: number, memberIds: number[]): Promise<void>;
  /** A party's popularity just changed by `delta` (shown as floating numbers over its pawn). */
  popChanged(playerId: number, delta: number): void;
  /** Draw the viewer's attention to a party (e.g. the target of a scandal). */
  spotlight(playerId: number): void;
  /** After a vote: the winning side celebrates, the losing side shakes its heads. */
  voteReaction(r: { outcome: 'passed' | 'vetoed'; happy: number[]; sad: number[] }): Promise<void>;
  /** `n` MPs walk across the chamber from one party's benches to another's. */
  floorCross(fromId: number, toId: number, n: number): Promise<void>;
  /** The TV-style election-night broadcast; resolves when the viewer continues. */
  electionNight(result: ElectionResult): Promise<void>;
  gameOver(result: GameResult): void;
}

interface Hit {
  ev: EventCardView;
  amount: number;
  tags: string[];
  options?: Mitigation[];
  /** Damage dealt by a rival (leaks, investigations): it can be reduced but not avoided entirely. */
  attack?: boolean;
}

interface Entry {
  opt: PromptOption;
  run?: () => void | Promise<void>;
}

interface Deal {
  partners: Player[];
  assign: Map<Portfolio, Player>;
  transfers: { to: Player; amount: number }[];
}

// AI valuation weights: how much a unit of each resource is worth in popularity points.
// ⭐ Political Capital is worth about this many popularity points to the AI.
const W_CAP = 0.8;
const W_CARD = 2.5;
const PF_VALUE: Record<Portfolio, number> = { economy: 1.2, information: 1, environment: 0.8, interior: 1.1 };

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const pn = (p: Player) => `<b style="color:${hex(p.party.color)}">${p.party.name}</b>`;

// ───────────── party references in both languages ─────────────
/** "the National Union" / "a União Nacional". */
const the = (p: Player) => (isPT ? `${art(p.party)} ${pn(p)}` : `the ${pn(p)}`);
/** Sentence-initial: "The National Union" / "A União Nacional". */
const The = (p: Player) => (isPT ? `${art(p.party).toUpperCase()} ${pn(p)}` : `The ${pn(p)}`);
/** Portuguese "do/da X" (of the party). */
const doP = (p: Player) => `${deArt(p.party)} ${pn(p)}`;
/** Portuguese "ao/à X" (to the party). */
const aoP = (p: Player) => `${aoArt(p.party)} ${pn(p)}`;
/** "X and Y" / "X e Y". */
const and = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} ${L('and', 'e')} ${items.at(-1)}` : (items[0] ?? ''));
const pop = (n: number) => L(`${R.fmt(n)} popularity`, `${R.fmt(n)} de popularidade`);
const ordinal = (n: number) => (isPT ? (['', 'primeira', 'segunda', 'terceira'][n] ?? `${n}ª`) : (['', 'first', 'second', 'third'][n] ?? `${n}th`));

/** A face-up event deck that reshuffles its discards when it runs out. */
class Pile<T> {
  private cards: T[];
  private used: T[] = [];
  constructor(items: readonly T[]) {
    this.cards = R.shuffle([...items]);
  }
  next(): T {
    if (!this.cards.length) {
      this.cards = R.shuffle(this.used);
      this.used = [];
    }
    const c = this.cards.pop()!;
    this.used.push(c);
    return c;
  }
}

const eventFace = (label: string, ev: { name: string; flavor: string; text: string }): CardFace => ({ label, title: ev.name, flavor: ev.flavor, text: ev.text });

/** "Ecologism and Interventionism" for a bill's target positions. */
const billStance = (c: Card) => and(AXIS_KEYS.filter((k) => c.target![k] !== undefined).map((k) => R.poleName(k, c.target![k]!)));
const lawText = (c: Card) =>
  L(
    `A bill rooted in ${billStance(c)}. Parties that share these values win popularity by introducing it; for anyone else it looks like a flip-flop. With ${R.MAJORITY} votes in parliament it becomes law.`,
    `Um projeto baseado em ${billStance(c)}. Partidos que compartilham esses valores ganham popularidade ao apresentá-lo; para os demais, parece incoerência. Com ${R.MAJORITY} votos no parlamento, vira lei.`,
  );
const LABEL_BILL = L('POLICY BILL', 'PROJETO DE LEI');
const LABEL_COALITION = L('🤝 COALITION BILL', '🤝 PROJETO DA COALIZÃO');
const lawFace = (c: Card): CardFace => ({ label: LABEL_BILL, title: c.name, flavor: c.text, text: lawText(c) });
const billView = (c: Card, coalition = false): EventCardView => ({
  title: c.name,
  subtitle: coalition ? LABEL_COALITION : LABEL_BILL,
  flavor: c.text,
  text: coalition
    ? `${lawText(c)} ${L('This is a coalition bill: every governing party is expected to vote for it.', 'É um projeto da coalizão: espera-se que todo partido do governo vote a favor.')}`
    : lawText(c),
  tone: coalition ? 'gov' : 'info',
});

const LABEL_MEDIA = L('MEDIA & CAMPAIGNS', 'MÍDIA E CAMPANHA');
const rallyText = (m: MediaDef) => `${m.rallyCost ? `${m.rallyCost} ⭐` : L('Free', 'Grátis')} → +${m.rallyGain} ${L('popularity', 'de popularidade')}`;
const mediaText = (m: MediaDef) =>
  L(
    `Use the spotlight for a press conference, drawing ${m.draw} strategy cards and keeping the best, or turn it into a campaign rally${m.rallyCost ? ` for ${m.rallyCost} ⭐ capital` : ' at no cost'} that wins ${m.rallyGain} popularity.`,
    `Use os holofotes numa coletiva de imprensa, comprando ${m.draw} cartas de estratégia e ficando com a melhor, ou transforme a ocasião num comício${m.rallyCost ? ` por ${m.rallyCost} ⭐ de capital` : ' sem custo'} que rende ${m.rallyGain} de popularidade.`,
  );
const mediaFace = (m: MediaDef): CardFace => ({ label: LABEL_MEDIA, title: m.name, flavor: m.flavor, text: mediaText(m) });

const LABEL_LOBBY = L('LOBBYISTS & FACTIONS', 'LOBISTAS E FACÇÕES');
function lobbyText(lb: LobbyDef): string {
  const pole = lb.side === 'low' ? AXIS_INFO[lb.axis].low : AXIS_INFO[lb.axis].high;
  return L(
    `They back parties that stand for ${pole}, offering ${lb.capital} ⭐ Political Capital with no strings attached. Anyone else can take the deal too, but their own supporters will see it as a betrayal and ${lb.penalty} popularity walks out the door (half that for parties in the middle).`,
    `Eles apoiam partidos que defendem ${pole}, oferecendo ${lb.capital} ⭐ de Capital Político sem amarras. Qualquer outro pode aceitar também, mas os próprios apoiadores verão isso como traição e ${lb.penalty} de popularidade irão embora (metade disso para partidos de centro).`,
  );
}

const LABEL_CRISIS = L('NATIONAL CRISIS', 'CRISE NACIONAL');

export class Engine {
  readonly players: Player[];
  // Player decks (cards go into hands) and face-up event decks.
  private laws: Card[];
  private lawDiscard: Card[] = [];
  private strategy: Card[];
  private strategyDiscard: Card[] = [];
  private readonly crises = new Pile(CRISIS_EVENTS);
  private readonly globals = new Pile(GLOBAL_CRISES);
  private readonly lobbies = new Pile(LOBBIES);
  private readonly medias = new Pile(MEDIA_EVENTS);
  turn = 0;
  electionsHeld = 0;
  private midtermYear = 0;
  /** Each party may veto once per year: the year it last used its veto. */
  private readonly vetoYear = new Map<number, number>();
  /** Times each coalition partner has voted against a coalition bill under the current government. */
  private readonly rebellions = new Map<number, number>();
  over = false;
  readonly mood: Axes;
  result: GameResult | null = null;

  constructor(
    setups: PlayerSetup[],
    private controllers: Controller[],
    private view: GameView,
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
      stats: { pmYears: 0, cabinetYears: 0, billsPassed: 0, billsIntroduced: 0, electionWins: 0 },
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

  // ───────────────────────────── main loop ─────────────────────────────

  async run(): Promise<void> {
    const seats = R.allocateSeats(this.players.map(() => 1));
    this.players.forEach((p, i) => (p.seats = seats[i]));
    this.view.seatsChanged();
    // Opening hand: every party is dealt 7 policy bills from the LAW deck.
    for (const p of this.players) {
      for (let i = 0; i < R.START_HAND; i++) {
        const c = this.drawOne('law');
        if (c) p.hand.push(c);
      }
    }
    await this.view.dealOpening(R.START_HAND);
    this.view.log(L('<b>Year 1 begins.</b> Parliament is evenly split between all parties.', '<b>Começa o Ano 1.</b> O parlamento está dividido igualmente entre todos os partidos.'), 'turn');
    await this.view.banner('COALITION', L('Year 1 begins — parliament is evenly split. Who will form the first government?', 'Começa o Ano 1 — o parlamento está dividido igualmente. Quem formará o primeiro governo?'), 'gov');
    await this.formGovernment(-1, true);
    this.yearStartPerks();

    while (!this.over) {
      await this.takeTurn(this.current);
      if (this.over) break;
      this.turn = (this.turn + 1) % this.players.length;
    }
  }

  private async takeTurn(p: Player): Promise<void> {
    // Parties that already reached the Election square sit out until everyone has arrived.
    if (p.waiting) {
      this.view.log(L(`${pn(p)} waits at the Election square for the other parties.`, `${pn(p)} espera na casa da Eleição pelos outros partidos.`));
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
    this.view.log(L(`${pn(p)} rolls ${roll} and heads to the ${dest.icon} ${dest.name}.`, `${pn(p)} tira ${roll} e vai para ${dest.icon} ${dest.name}.`));

    const arrived = await this.move(p, steps);
    if (this.over || arrived) return;
    await this.resolveSquare(p);
    if (this.over) return;
    this.view.refresh();
  }

  /** Moves a pawn. Returns true if it reached the Election square, which ends its year. */
  private async move(p: Player, steps: number): Promise<boolean> {
    const from = p.position;
    await this.view.movePawn(p.id, from, steps);
    const raw = from + steps;
    p.position = raw % R.BOARD_SIZE;
    this.view.refresh();

    const midIndex = 25;
    if (from < midIndex && raw >= midIndex && this.midtermYear < this.year) {
      this.midtermYear = this.year;
      await this.midterm(p);
      if (this.over) return false;
    }
    if (raw >= R.BOARD_SIZE) {
      await this.arriveAtElection(p);
      return true;
    }
    return false;
  }

  /** A party reaches the Election square: it waits there; when the last party arrives, the nation votes. */
  private async arriveAtElection(p: Player): Promise<void> {
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
      L(`Every party has finished the year (+${g} ⭐ fundraiser for ${the(p)}). The nation now goes to the polls.`, `Todos os partidos terminaram o ano (+${g} ⭐ de arrecadação para ${the(p)}). Agora o país vai às urnas.`),
      'event',
    );
    await this.election(p);
    for (const q of this.players) q.waiting = false;
    this.view.refresh();
  }

  private async resolveSquare(p: Player): Promise<void> {
    const type = BOARD[p.position];
    this.view.flashTile(p.position);
    switch (type) {
      case 'formation':
        if (p.inGov) {
          this.gainCapital(p, 2);
          await this.tell(p, L('attended the cabinet briefing', 'participou da reunião do gabinete'), L(`As a governing party, ${the(p)} gains 2 ⭐ Political Capital.`, `Como partido do governo, ${the(p)} ganha 2 ⭐ de Capital Político.`), 'gov');
        } else {
          if (this.draw(p, 1).length) await this.view.drawCard('strategy', p.id);
          await this.tell(
            p,
            L('studied the government programme', 'estudou o programa do governo'),
            L('From the opposition benches the party draws a new STRATEGY card to plan its next attack.', 'Dos bancos da oposição, o partido compra uma nova carta de ESTRATÉGIA para planejar o próximo ataque.'),
            'info',
          );
        }
        break;
      case 'midterm': {
        const got = this.gainPop(p, 4);
        const g = this.gainCapital(p, 2);
        await this.tell(p, L('held a rousing party convention', 'fez uma convenção partidária empolgante'), L(`Members are fired up: ${pop(got)} and ${g} ⭐ Political Capital.`, `A militância está animada: ${pop(got)} e ${g} ⭐ de Capital Político.`), 'good');
        break;
      }
      case 'debate':
        await this.debate(p);
        break;
      case 'legislature':
        await this.legislature(p);
        break;
      case 'media':
        await this.media(p);
        break;
      case 'crisis':
        await this.crisis(p);
        break;
      case 'lobby':
        await this.lobby(p);
        break;
      case 'committee':
        await this.committee(p);
        break;
    }
    this.view.refresh();
  }

  // ───────────────────────────── squares ─────────────────────────────

  private async legislature(p: Player): Promise<void> {
    // Every Legislature Pass starts by drawing a fresh bill from the LAW deck.
    const fresh = this.drawOne('law');
    if (fresh) {
      p.hand.push(fresh);
      await this.view.drawCard('law', p.id, lawFace(fresh));
    }
    const bills = p.hand.filter((c) => c.kind === 'bill');
    if (!bills.length) {
      await this.tell(p, L('had nothing to put before parliament', 'não tinha nada para levar ao plenário'), L('The LAW deck is empty, so the session passes quietly.', 'O baralho de LEIS acabou, então a sessão passa em silêncio.'), 'info');
      return;
    }

    const i = await this.ask(p, {
      title: L('Legislature Pass — introduce a bill', 'Votação no Plenário — apresente um projeto'),
      body: L(
        `You drew <b>${fresh?.name ?? 'a bill'}</b> from the LAW deck. Introducing one bill is <b>mandatory</b>. Bills that match your ideology win popularity <b>only if they become law</b>; misaligned bills cause a voter backlash either way. With <b>${R.MAJORITY}+</b> votes it becomes law (+2 ⭐ capital for you, +1 popularity for every governing party), unless an opponent pays ${R.VETO_COST} ⭐ to veto it.${
          p.inGov ? ' <br><b>🤝 You are in government, so this will be a coalition bill:</b> your partners are expected to vote YES, and any who rebel risk expulsion.' : ''
        }`,
        `Você comprou <b>${fresh?.name ?? 'um projeto'}</b> do baralho de LEIS. Apresentar um projeto é <b>obrigatório</b>. Projetos alinhados à sua ideologia rendem popularidade <b>só se virarem lei</b>; projetos desalinhados irritam seus eleitores de qualquer jeito. Com <b>${R.MAJORITY}+</b> votos ele vira lei (+2 ⭐ de capital para você, +1 de popularidade para cada partido do governo), a menos que um adversário pague ${R.VETO_COST} ⭐ para vetá-lo.${
          p.inGov ? ' <br><b>🤝 Você está no governo, então este será um projeto da coalizão:</b> seus aliados devem votar SIM, e quem se rebelar arrisca a expulsão.' : ''
        }`,
      ),
      options: bills.map((c) => {
        const d = R.billDelta(p.party.axes, c.target!);
        const passes = this.tally(c, p, new Set()).yes >= R.MAJORITY;
        return {
          label: c.name,
          detail: passes ? `${pop(d)} · ${L('likely passes', 'deve passar')}` : `${L('likely fails', 'deve cair')}${d < 0 ? ` · ${pop(d)}` : ` · ${L('no popularity', 'sem popularidade')}`}`,
          card: c,
          ai: passes ? d + 2 : Math.min(d, 0),
        };
      }),
    });
    const bill = bills[i];
    this.removeCard(p, bill);
    p.stats.billsIntroduced++;
    this.view.refresh();
    const delta = R.billDelta(p.party.axes, bill.target!);
    const coalition = p.inGov;
    const card = billView(bill, coalition);

    // Coalition discipline: partners who dislike a government bill must choose to back it or rebel.
    const forced = new Set<number>();
    const rebels: Player[] = [];
    const loyal: string[] = [];
    if (coalition) {
      this.view.log(L(`🤝 <b>Coalition bill:</b> ${pn(p)} introduces <i>${bill.name}</i> on behalf of the government.`, `🤝 <b>Projeto da coalizão:</b> ${pn(p)} apresenta <i>${bill.name}</i> em nome do governo.`), 'gov');
      await this.view.banner(
        L('🤝 Coalition Bill', '🤝 Projeto da Coalizão'),
        L(`${p.party.name} speaks for the government: coalition partners are expected to vote YES on the ${bill.name}.`, `${p.party.name} fala pelo governo: os aliados da coalizão devem votar SIM em ${bill.name}.`),
        'gov',
      );
      for (const q of this.players) {
        if (q === p || !q.inGov || q.isPM || this.votesFor(q, bill, p)) continue;
        const backlash = Math.max(1, Math.round((R.axisDistance(q.party.axes, bill.target!) - 1) * 2));
        const gov = this.players.filter((x) => x.inGov).reduce((s, x) => s + x.seats, 0);
        const safe = gov - q.seats >= R.MAJORITY;
        const strikes = this.rebellions.get(q.id) ?? 0;
        const risk = Math.min(0.95, (safe ? 0.6 : 0.25) + strikes * 0.3);
        const pm = this.pm();
        const pmRef = pm ? the(pm) : L('the Prime Minister', 'o Primeiro-Ministro');
        const k = await this.ask(q, {
          title: L(`Coalition vote: ${bill.name}`, `Votação da coalizão: ${bill.name}`),
          body: L(
            `Your coalition partner ${the(p)} has introduced a <b>coalition bill</b>, but your supporters dislike it.
            <ul class="choices">
              <li><b>Back the coalition:</b> vote YES. Your supporters grumble (−${backlash} popularity), but you keep your place in government.</li>
              <li><b>Rebel:</b> vote NO. Your supporters approve, but ${pmRef} may <b>expel you from the government</b>: you would lose your ministries and join the opposition.${strikes ? ` You have already rebelled ${strikes === 1 ? 'once' : `${strikes} times`}.` : ''}</li>
            </ul>`,
            `Seu aliado ${the(p)} apresentou um <b>projeto da coalizão</b>, mas seus apoiadores não gostam dele.
            <ul class="choices">
              <li><b>Apoiar a coalizão:</b> votar SIM. Seus apoiadores reclamam (−${backlash} de popularidade), mas você continua no governo.</li>
              <li><b>Rebelar-se:</b> votar NÃO. Seus apoiadores aprovam, mas ${pmRef} pode <b>expulsar você do governo</b>: você perderia seus ministérios e iria para a oposição.${strikes ? ` Você já se rebelou ${strikes === 1 ? 'uma vez' : `${strikes} vezes`}.` : ''}</li>
            </ul>`,
          ),
          event: card,
          options: [
            { label: L('Back the coalition (vote YES)', 'Apoiar a coalizão (votar SIM)'), detail: `−${backlash} ${L('popularity', 'de popularidade')}`, ai: -backlash },
            { label: L('Rebel (vote NO)', 'Rebelar-se (votar NÃO)'), detail: L('Risk being expelled from government', 'Risco de ser expulso do governo'), ai: -risk * (3 + q.portfolios.length * 2.5) },
          ],
        });
        if (k === 0) {
          forced.add(q.id);
          const lost = this.gainPop(q, -backlash);
          loyal.push(L(`${The(q)} held its nose and voted YES for coalition unity (${pop(lost)}).`, `${The(q)} engoliu em seco e votou SIM pela unidade da coalizão (${pop(lost)}).`));
        } else rebels.push(q);
      }
    }

    // Whipping votes
    const whipped: Player[] = [];
    let tally = this.tally(bill, p, forced);
    for (let guard = 0; guard < 4 && tally.yes < R.MAJORITY; guard++) {
      const target = this.players.filter((q) => !tally.yesIds.has(q.id)).sort((a, b) => b.seats - a.seats)[0];
      if (!target) break;
      const whip = p.hand.find((c) => c.kind === 'whip');
      const after = tally.yes + target.seats;
      const success = after >= R.MAJORITY ? 5 : -1;
      const forceDetail = L(`Force ${target.party.name} (${target.seats} seats) → ${after} yes`, `Força ${target.party.name} (${target.seats} cadeiras) → ${after} sim`);
      const entries: Entry[] = [{ opt: { label: L('Proceed to the vote', 'Ir para a votação'), detail: L(`${tally.yes} of ${R.TOTAL_SEATS} seats in favour`, `${tally.yes} de ${R.TOTAL_SEATS} cadeiras a favor`), ai: 0 } }];
      const doForce = (how: string) => {
        forced.add(target.id);
        whipped.push(target);
        this.view.log(L(`${pn(p)} ${how}: ${pn(target)} must vote YES.`, `${pn(p)} ${how}: ${pn(target)} tem que votar SIM.`));
      };
      if (whip) {
        entries.push({
          opt: { label: L(`Play ${whip.name}`, `Jogar ${whip.name}`), detail: forceDetail, ai: success - W_CARD * 0.5 },
          run: () => {
            this.removeCard(p, whip);
            doForce(L(`plays <i>${whip.name}</i>`, `joga <i>${whip.name}</i>`));
          },
        });
      }
      if (p.capital >= R.WHIP_COST) {
        entries.push({
          opt: { label: L(`Whip Vote (${R.WHIP_COST} ⭐)`, `Pressionar a Bancada (${R.WHIP_COST} ⭐)`), detail: forceDetail, ai: success - R.WHIP_COST * W_CAP },
          run: () => {
            p.capital -= R.WHIP_COST;
            doForce(L(`calls in favours (${R.WHIP_COST} ⭐)`, `cobra favores (${R.WHIP_COST} ⭐)`));
          },
        });
      }
      if (entries.length === 1) break;
      const k = await this.menu(
        p,
        L(`Whipping votes: ${bill.name}`, `Buscando votos: ${bill.name}`),
        L(`The bill has <b>${tally.yes}</b> votes; <b>${R.MAJORITY}</b> are needed to pass.`, `O projeto tem <b>${tally.yes}</b> votos; são necessários <b>${R.MAJORITY}</b> para passar.`),
        entries,
        { event: card },
      );
      if (k === 0) break;
      tally = this.tally(bill, p, forced);
    }

    // Veto by an opposing party
    let vetoedBy: Player | null = null;
    let vetoGain = 0;
    if (tally.yes >= R.MAJORITY) {
      for (const q of this.players) {
        if (q === p || tally.yesIds.has(q.id) || q.capital < R.VETO_COST || this.vetoYear.get(q.id) === this.year) continue;
        const cheer = R.vetoApplause(q.party.axes, bill.target!);
        const threat = (this.isLeader(p) ? 3 : 0) + Math.max(0, delta) * 0.25 + (q.inGov !== p.inGov ? 1 : 0) + cheer;
        const cheerLine = cheer
          ? L(
              `Your supporters ${cheer >= 5 ? 'strongly ' : ''}oppose this bill, so they will <b>cheer the veto: +${cheer} popularity</b> for you.`,
              `Seus apoiadores ${cheer >= 5 ? 'odeiam' : 'são contra'} este projeto, então vão <b>comemorar o veto: +${cheer} de popularidade</b> para você.`,
            )
          : L('Your supporters barely care about this bill, so the veto wins you no popularity.', 'Seus apoiadores pouco ligam para este projeto, então o veto não rende popularidade.');
        const k = await this.ask(q, {
          title: L(`Veto the ${bill.name}?`, `Vetar ${bill.name}?`),
          body: L(
            `${The(p)}'s bill has <b>${tally.yes}</b> votes, so it is about to pass. Your party voted against it.
            <ul class="choices">
              <li><b>Let it pass:</b> it becomes law. ${The(p)} earns +2 ⭐ capital and every governing party gains +1 popularity.</li>
              <li><b>Veto it (costs you ${R.VETO_COST} ⭐, and uses your one veto for this year):</b> the bill is blocked and does <b>not</b> become law, so ${the(p)} gets no +2 ⭐ and the government gets no popularity bonus. ${cheerLine} If the bill is blocked, ${the(p)} wins no popularity from it.</li>
            </ul>`,
            `O projeto ${doP(p)} tem <b>${tally.yes}</b> votos e está prestes a passar. Seu partido votou contra.
            <ul class="choices">
              <li><b>Deixar passar:</b> vira lei. ${The(p)} ganha +2 ⭐ de capital e cada partido do governo ganha +1 de popularidade.</li>
              <li><b>Vetar (custa ${R.VETO_COST} ⭐ e usa seu único veto do ano):</b> o projeto é barrado e <b>não</b> vira lei, então ${the(p)} não ganha os +2 ⭐ e o governo fica sem bônus de popularidade. ${cheerLine} Se o projeto for barrado, ${the(p)} não ganha popularidade com ele.</li>
            </ul>`,
          ),
          event: card,
          options: [
            { label: L('Let it pass', 'Deixar passar'), detail: L('The bill becomes law', 'O projeto vira lei'), ai: 0 },
            {
              label: L(`Veto it (−${R.VETO_COST} ⭐)`, `Vetar (−${R.VETO_COST} ⭐)`),
              detail: cheer ? L(`The bill is blocked · your supporters cheer: +${cheer} popularity`, `O projeto é barrado · seus apoiadores comemoram: +${cheer} de popularidade`) : L('The bill is blocked', 'O projeto é barrado'),
              ai: threat - R.VETO_COST * W_CAP,
            },
          ],
        });
        if (k === 1) {
          q.capital -= R.VETO_COST;
          vetoedBy = q;
          this.vetoYear.set(q.id, this.year);
          vetoGain = cheer ? this.gainPop(q, cheer) : 0;
          break;
        }
      }
    }

    // Supporters only reward a bill that actually becomes law; a misaligned proposal angers them either way.
    const passed = !vetoedBy && tally.yes >= R.MAJORITY;
    const got = passed || delta < 0 ? this.gainPop(p, delta) : 0;
    const no = R.TOTAL_SEATS - tally.yes;
    const stance =
      delta < 0
        ? L(`The bill goes against ${the(p)}'s ideology, so ${the(p)}'s own supporters punish the flip-flop: ${pop(got)}.`, `O projeto contraria a ideologia ${doP(p)}, então os próprios apoiadores punem a incoerência: ${pop(got)}.`)
        : passed
          ? L(`The bill fits ${the(p)}'s ideology, so ${the(p)}'s supporters reward the party: ${pop(got)}.`, `O projeto combina com a ideologia ${doP(p)}, então os apoiadores recompensam o partido: ${pop(got)}.`)
          : L(`The bill fits ${the(p)}'s ideology, but it never became law, so ${the(p)} wins <b>no popularity</b> from it.`, `O projeto combina com a ideologia ${doP(p)}, mas não virou lei, então ${the(p)} <b>não ganha popularidade</b> com ele.`);
    const stillRebels = rebels.filter((r) => !forced.has(r.id));
    const coalitionNote = [
      ...loyal,
      ...(stillRebels.length
        ? [
            L(
              `${and(stillRebels.map(The))} <b>rebelled</b> and voted NO against ${stillRebels.length > 1 ? 'their' : 'its'} own government.`,
              `${and(stillRebels.map(The))} <b>se rebelou</b> e votou NÃO contra o próprio governo.`.replace('se rebelou e votou', stillRebels.length > 1 ? 'se rebelaram e votaram' : 'se rebelou e votou'),
            ),
          ]
        : []),
    ].join(' ');
    const whipNote = (coalitionNote ? coalitionNote + ' ' : '') + (whipped.length ? L(`${The(p)} whipped ${and(whipped.map(the))} into voting yes. `, `${The(p)} enquadrou ${and(whipped.map(the))} para votar sim. `) : '');
    const did = coalition
      ? L(`introduced the <i>${bill.name}</i>, a <b>coalition bill</b>`, `apresentou <i>${bill.name}</i>, um <b>projeto da coalizão</b>`)
      : L(`introduced the <i>${bill.name}</i> in parliament`, `apresentou <i>${bill.name}</i> no plenário`);
    const yesIds = this.players.filter((q) => tally.yesIds.has(q.id)).map((q) => q.id);
    const noIds = this.players.filter((q) => !tally.yesIds.has(q.id)).map((q) => q.id);
    if (vetoedBy) await this.view.voteReaction({ outcome: 'vetoed', happy: noIds, sad: yesIds });
    else if (passed) await this.view.voteReaction({ outcome: 'passed', happy: yesIds, sad: noIds });
    if (vetoedBy) {
      const cheered = vetoGain
        ? L(`${The(vetoedBy)}'s supporters opposed the bill and cheer the veto: ${pop(vetoGain)} for ${the(vetoedBy)}. `, `Os apoiadores ${doP(vetoedBy)} eram contra o projeto e comemoram o veto: ${pop(vetoGain)} para ${the(vetoedBy)}. `)
        : '';
      await this.tell(
        p,
        did,
        L(
          `${whipNote}It had enough votes to pass (${tally.yes}–${no}), but ${the(vetoedBy)} paid ${R.VETO_COST} ⭐ to <b>veto</b> it. The bill is <b>blocked</b> and does not become law, so ${the(p)} misses out on the +2 ⭐ capital and the government gets no popularity bonus. ${cheered}${stance}`,
          `${whipNote}Tinha votos para passar (${tally.yes}–${no}), mas ${the(vetoedBy)} pagou ${R.VETO_COST} ⭐ para <b>vetar</b>. O projeto foi <b>barrado</b> e não vira lei, então ${the(p)} fica sem os +2 ⭐ de capital e o governo sem bônus de popularidade. ${cheered}${stance}`,
        ),
        'bad',
        { card: bill },
      );
    } else if (tally.yes >= R.MAJORITY) {
      this.gainCapital(p, 2);
      p.stats.billsPassed++;
      for (const q of this.players) if (q.inGov) this.gainPop(q, 1);
      await this.tell(
        p,
        did,
        L(
          `${whipNote}Parliament voted <b>${tally.yes}–${no}</b> and the bill <b>became law</b>. ${stance} ${The(p)} also earns +2 ⭐ Political Capital, and every governing party gains +1 popularity.`,
          `${whipNote}O plenário votou <b>${tally.yes}–${no}</b> e o projeto <b>virou lei</b>. ${stance} ${The(p)} ainda ganha +2 ⭐ de Capital Político, e cada partido do governo ganha +1 de popularidade.`,
        ),
        delta >= 0 ? 'good' : 'bad',
        { card: bill },
      );
    } else {
      await this.tell(
        p,
        did,
        L(
          `${whipNote}Parliament voted <b>${tally.yes}–${no}</b>: short of the ${R.MAJORITY} votes needed, so the bill <b>failed</b>. ${stance}`,
          `${whipNote}O plenário votou <b>${tally.yes}–${no}</b>: abaixo dos ${R.MAJORITY} votos necessários, então o projeto <b>caiu</b>. ${stance}`,
        ),
        'bad',
        { card: bill },
      );
    }

    for (const r of stillRebels) await this.disciplineRebel(r, bill);
  }

  /** The Prime Minister decides whether a coalition partner who voted against a coalition bill is warned or expelled. */
  private async disciplineRebel(r: Player, bill: Card): Promise<void> {
    const pm = this.pm();
    if (!pm || pm === r || !r.inGov) return;
    const strikes = (this.rebellions.get(r.id) ?? 0) + 1;
    this.rebellions.set(r.id, strikes);
    const gov = this.players.filter((x) => x.inGov).reduce((s, x) => s + x.seats, 0);
    const after = gov - r.seats;
    const keeps = after >= R.MAJORITY;
    const nth = ordinal(strikes);
    const shorts = r.portfolios.map((pf) => PORTFOLIO_INFO[pf].short).join(', ') || L('none', 'nenhum');
    this.view.spotlight(pm.id);
    const k = await this.ask(pm, {
      title: L(`${r.party.name} voted against your government`, `${r.party.name} votou contra o seu governo`),
      body: L(
        `${The(r)} rebelled on the <i>${bill.name}</i>. This is their <b>${nth}</b> rebellion.
        <ul class="choices">
          <li><b>Give a warning:</b> they keep their ministries (${shorts}) and the coalition stays together.</li>
          <li><b>Expel them:</b> they lose their ministries (you take them over) and join the opposition. Your government would hold <b>${after}</b> seats${keeps ? ', still a majority' : `, a <b>minority</b> (below ${R.MAJORITY})`}.</li>
        </ul>`,
        `${The(r)} se rebelou em <i>${bill.name}</i>. É a <b>${nth}</b> rebelião.
        <ul class="choices">
          <li><b>Dar uma advertência:</b> o partido mantém seus ministérios (${shorts}) e a coalizão continua unida.</li>
          <li><b>Expulsar:</b> o partido perde os ministérios (que passam para você) e vai para a oposição. Seu governo ficaria com <b>${after}</b> cadeiras${keeps ? ', ainda uma maioria' : `, uma <b>minoria</b> (abaixo de ${R.MAJORITY})`}.</li>
        </ul>`,
      ),
      options: [
        { label: L('Give them a warning', 'Dar uma advertência'), detail: L('Keep the coalition together', 'Manter a coalizão unida'), ai: 0 },
        {
          label: L('Expel them from the government', 'Expulsar do governo'),
          detail: keeps ? L(`Government keeps ${after} seats`, `O governo fica com ${after} cadeiras`) : L(`Government drops to ${after} seats (minority)`, `O governo cai para ${after} cadeiras (minoria)`),
          ai: (keeps ? 1.5 : -4) + (strikes - 1) * 3 + (Math.random() - 0.5),
        },
      ],
    });
    if (k === 0) {
      await this.tell(
        pm,
        L(`gave ${the(r)} a warning`, `deu uma advertência ${aoP(r)}`),
        L(
          `${The(r)} voted against the <i>${bill.name}</i> but keeps its place in government. That was its ${nth} rebellion; next time ${the(pm)} may not be so forgiving.`,
          `${The(r)} votou contra <i>${bill.name}</i>, mas continua no governo. Foi a ${nth} rebelião; da próxima vez ${the(pm)} pode não perdoar.`,
        ),
        'gov',
      );
      return;
    }
    const lost = r.portfolios;
    r.inGov = false;
    pm.portfolios.push(...lost);
    r.portfolios = [];
    this.rebellions.delete(r.id);
    this.view.seatsChanged();
    const titles = lost.map((pf) => PORTFOLIO_INFO[pf].title).join(', ');
    await this.tell(
      pm,
      L(`expelled ${the(r)} from the government`, `expulsou ${the(r)} do governo`),
      L(
        `${The(r)} voted against the <i>${bill.name}</i> one time too many. It loses ${lost.length ? `its ministries (${titles}), which pass to ${the(pm)},` : 'its place at the cabinet table'} and joins the opposition. The government now holds ${after} seats${keeps ? ', still a majority' : ', a <b>minority government</b> that will struggle to pass laws'}.`,
        `${The(r)} votou contra <i>${bill.name}</i> uma vez a mais. Perde ${lost.length ? `seus ministérios (${titles}), que passam ${aoP(pm)},` : 'seu lugar no gabinete'} e vai para a oposição. O governo agora tem ${after} cadeiras${keeps ? ', ainda uma maioria' : ', um <b>governo de minoria</b> que terá dificuldade para aprovar leis'}.`,
      ),
      'event',
    );
  }

  private tally(bill: Card, intro: Player, forced: Set<number>) {
    const yesIds = new Set<number>();
    let yes = 0;
    for (const q of this.players) {
      if (q === intro || forced.has(q.id) || this.votesFor(q, bill, intro)) {
        yesIds.add(q.id);
        yes += q.seats;
      }
    }
    return { yes, yesIds };
  }

  private votesFor(q: Player, bill: Card, intro: Player): boolean {
    const d = R.axisDistance(q.party.axes, bill.target!);
    if (intro.isPM && q.inGov && d <= 1.75) return true; // coalition loyalty
    return d <= 1.25;
  }

  private async media(p: Player): Promise<void> {
    if (p.portfolios.includes('economy')) {
      const g = this.gainCapital(p, 1);
      this.view.log(L(`${pn(p)} collects campaign donations as Minister of Economy (+${g} ⭐).`, `${pn(p)} recebe doações de campanha pelo Ministério da Economia (+${g} ⭐).`));
    }
    // The MEDIA deck decides what kind of press opportunity this is.
    const md = this.medias.next();
    await this.view.drawCard('media', p.id, mediaFace(md));
    const card: EventCardView = { title: md.name, subtitle: LABEL_MEDIA, flavor: md.flavor, text: mediaText(md), tone: 'info' };
    const full = p.hand.length >= R.HAND_LIMIT;
    const poor = p.capital < md.rallyCost;
    const noCap = L('Not enough capital', 'Capital insuficiente');
    const entries: Entry[] = [
      {
        opt: {
          label: L('🎤 Press Conference', '🎤 Coletiva de Imprensa'),
          detail: L(`Draw ${md.draw} strategy cards, keep 1`, `Compre ${md.draw} cartas de estratégia, fique com 1`),
          disabled: full ? L('Hand is full', 'Mão cheia') : undefined,
          ai: p.hand.length < 8 ? 3 : 0.5,
        },
        run: () => this.pressConference(p, md, card),
      },
      {
        opt: {
          label: L('📣 Campaign Rally', '📣 Comício'),
          detail: rallyText(md),
          disabled: poor ? noCap : undefined,
          ai: md.rallyGain - md.rallyCost * W_CAP - (md.rallyCost && p.capital - md.rallyCost < 3 ? 3 : 0),
        },
        run: async () => {
          p.capital -= md.rallyCost;
          const got = this.gainPop(p, md.rallyGain);
          await this.tell(
            p,
            L(`decided to turn the ${md.name.toLowerCase()} into a campaign rally`, `decidiu transformar ${md.name.toLowerCase()} em comício`),
            L(
              `${md.rallyCost ? `${The(p)} spends ${md.rallyCost} ⭐ capital` : 'It costs nothing'}, and ${the(p)} wins ${pop(got)}.`,
              `${md.rallyCost ? `${The(p)} gasta ${md.rallyCost} ⭐ de capital` : 'Não custa nada'}, e ${the(p)} ganha ${pop(got)}.`,
            ),
            'good',
            { event: card },
          );
        },
      },
    ];
    // Populist rally cards from the hand can be played here too.
    const seen = new Set<string>();
    for (const c of p.hand) {
      if (c.kind !== 'rally' || seen.has(c.key)) continue;
      seen.add(c.key);
      const cost = c.cost!;
      entries.push({
        opt: {
          label: L(`Play ${c.name}`, `Jogar ${c.name}`),
          detail: `${cost} ⭐ → +${c.power} ${L('popularity', 'de popularidade')}${c.key === 'blitz' ? L(' and a card', ' e uma carta') : ''}`,
          card: c,
          disabled: p.capital < cost ? noCap : undefined,
          ai: c.power! - cost * W_CAP - (p.capital - cost < 4 ? 4 : 0) - (p.popularity > 92 ? 10 : 0),
        },
        run: async () => {
          this.removeCard(p, c);
          p.capital -= cost;
          const got = this.gainPop(p, c.power!);
          if (c.key === 'blitz') this.draw(p, 1);
          await this.tell(
            p,
            L(`decided to stage the <i>${c.name}</i> in front of the cameras`, `decidiu fazer o <i>${c.name}</i> diante das câmeras`),
            L(
              `A populist rally works whatever your ideology: ${the(p)} spends ${cost} ⭐ capital and wins ${pop(got)}${c.key === 'blitz' ? ', plus a new card' : ''}.`,
              `Um comício populista funciona qualquer que seja a ideologia: ${the(p)} gasta ${cost} ⭐ de capital e ganha ${pop(got)}${c.key === 'blitz' ? ', além de uma carta nova' : ''}.`,
            ),
            'good',
            { card: c },
          );
        },
      });
    }
    if (entries.every((e) => e.opt.disabled)) {
      entries.push({
        opt: { label: L('Shake some hands and move on', 'Apertar algumas mãos e seguir'), ai: 0 },
        run: () =>
          this.tell(
            p,
            L('shook a few hands with reporters', 'cumprimentou alguns repórteres'),
            L(`With a full hand and an empty purse, nothing changes for ${the(p)} today.`, `Com a mão cheia e o caixa vazio, nada muda hoje para ${the(p)}.`),
            'info',
            { event: card },
          ),
      });
    }
    await this.menu(p, md.name, L('You drew this card from the MEDIA deck. How will you use it?', 'Você comprou esta carta do baralho de MÍDIA. Como vai usá-la?'), entries, { event: card });
  }

  private async pressConference(p: Player, md: MediaDef, card: EventCardView): Promise<void> {
    const cards: Card[] = [];
    for (let i = 0; i < md.draw; i++) {
      const c = this.drawOne('strategy');
      if (c) cards.push(c);
    }
    if (!cards.length) return;
    await this.view.drawCard('strategy', p.id);
    const i =
      cards.length === 1
        ? 0
        : await this.ask(p, {
            title: L('Press Conference — keep one card', 'Coletiva de Imprensa — fique com uma carta'),
            body: L('The others go to the discard pile.', 'As outras vão para o descarte.'),
            options: cards.map((c) => ({ label: c.name, card: c, ai: this.cardValue(p, c) })),
          });
    p.hand.push(cards[i]);
    cards.forEach((c, j) => j !== i && this.strategyDiscard.push(c));
    await this.tell(
      p,
      L(`decided to hold a press conference for the ${md.name.toLowerCase()}`, `decidiu fazer uma coletiva de imprensa: ${md.name.toLowerCase()}`),
      L(
        `${The(p)} draws ${cards.length} cards from the STRATEGY deck and secretly keeps the most useful one for later.`,
        `${The(p)} compra ${cards.length} cartas do baralho de ESTRATÉGIA e guarda em segredo a mais útil para depois.`,
      ),
      'info',
      { event: card },
    );
  }

  private async crisis(p: Player): Promise<void> {
    const ev = this.crises.next();
    await this.view.drawCard('crisis', p.id, eventFace(LABEL_CRISIS, ev));
    if (ev.special === 'floorcross') await this.floorCrossing(p, ev);
    else await this.applyEvent(p, ev, L('LOCAL CRISIS', 'CRISE LOCAL'));
  }

  /** Floor crossing: some of a party's MPs defect, seats and all, to the closest rival until the next election. */
  private async floorCrossing(p: Player, ev: EventDef): Promise<void> {
    const dest = this.players.filter((q) => q !== p).sort((a, b) => R.partyDistance(p.party.axes, a.party.axes) - R.partyDistance(p.party.axes, b.party.axes))[0];
    const n = Math.min(p.seats - 1, R.clamp(Math.round(p.seats * 0.12), 2, 6));
    const card: EventCardView = {
      title: ev.name,
      subtitle: LABEL_CRISIS,
      flavor: ev.flavor,
      text: L(
        `${n} of your MPs are ready to cross the floor to ${dest.party.name}, the party closest to their views, taking their seats with them until the next election.`,
        `${n} dos seus deputados estão prontos para mudar para ${dest.party.name}, o partido mais próximo das ideias deles, levando as cadeiras até a próxima eleição.`,
      ),
      tone: 'bad',
    };
    if (!dest || n <= 0) {
      await this.tell(p, L('survived a floor-crossing scare', 'sobreviveu a um susto de troca de partido'), L('The rebels lost their nerve: nobody crossed the floor.', 'Os rebeldes perderam a coragem: ninguém mudou de lado.'), 'info', { event: card });
      return;
    }
    const govNow = this.players.filter((q) => q.inGov).reduce((s, q) => s + q.seats, 0);
    const breaksGov = p.inGov !== dest.inGov && p.inGov && govNow >= R.MAJORITY && govNow - n < R.MAJORITY;
    const half = Math.ceil(n / 2);
    const cross = async (k: number, how: string) => {
      if (k <= 0) {
        await this.tell(p, L('stopped a floor-crossing', 'impediu uma troca de partido'), L(`${how} Every MP stays with ${the(p)}.`, `${how} Todos os deputados ficam com ${the(p)}.`), 'good', { event: card });
        return;
      }
      p.seats -= k;
      dest.seats += k;
      this.view.spotlight(p.id);
      await this.view.floorCross(p.id, dest.id, k);
      this.view.seatsChanged();
      const gov = this.players.filter((q) => q.inGov).reduce((s, q) => s + q.seats, 0);
      const govNote =
        p.inGov !== dest.inGov
          ? L(
              ` The government now holds ${gov} seats${gov < R.MAJORITY ? (govNow >= R.MAJORITY ? ' and has <b>lost its majority</b>!' : ', still short of a majority.') : '.'}`,
              ` O governo agora tem ${gov} cadeiras${gov < R.MAJORITY ? (govNow >= R.MAJORITY ? ' e <b>perdeu a maioria</b>!' : ', ainda sem maioria.') : '.'}`,
            )
          : '';
      await this.tell(
        p,
        L(`watched ${k} of its MPs cross the floor to ${the(dest)}`, `viu ${k} dos seus deputados mudarem para ${the(dest)}`),
        L(
          `${how} The defectors take their seats with them until the next election: ${the(p)} now holds ${p.seats} seats and ${the(dest)} ${dest.seats}.${govNote}`,
          `${how} Os desertores levam as cadeiras até a próxima eleição: ${the(p)} agora tem ${p.seats} cadeiras e ${the(dest)}, ${dest.seats}.${govNote}`,
        ),
        'bad',
        { event: card },
      );
    };
    const noCap = L('Not enough capital', 'Capital insuficiente');
    await this.menu(
      p,
      ev.name,
      L(
        `${n} MPs are about to defect to ${the(dest)}.${breaksGov ? ' <b>Losing them would cost the government its majority.</b>' : ''} What will you do?`,
        `${n} deputados estão prestes a desertar para ${the(dest)}.${breaksGov ? ' <b>Perdê-los custaria a maioria do governo.</b>' : ''} O que você vai fazer?`,
      ),
      [
        {
          opt: { label: L('Let them go', 'Deixá-los ir'), detail: L(`${n} seats move to ${dest.party.name}`, `${n} cadeiras vão para ${dest.party.name}`), ai: -n * 1.5 - (breaksGov ? 8 : 0) },
          run: () => cross(n, L(`${The(p)} let the rebels go.`, `${The(p)} deixou os rebeldes irem embora.`)),
        },
        {
          opt: {
            label: L('Promise them committee posts', 'Prometer cargos em comissões'),
            detail: L(`3 ⭐ → only ${half} cross`, `3 ⭐ → só ${half} mudam`),
            disabled: p.capital < 3 ? noCap : undefined,
            ai: -half * 1.5 - 3 * W_CAP - (breaksGov && govNow - half < R.MAJORITY ? 8 : 0),
          },
          run: () => {
            p.capital -= 3;
            return cross(half, L(`${The(p)} spent 3 ⭐ on promises, which kept some of the rebels.`, `${The(p)} gastou 3 ⭐ em promessas, que seguraram parte dos rebeldes.`));
          },
        },
        {
          opt: { label: L('Call an emergency party congress', 'Convocar um congresso de emergência'), detail: L('6 ⭐ → nobody crosses', '6 ⭐ → ninguém muda'), disabled: p.capital < 6 ? noCap : undefined, ai: -6 * W_CAP },
          run: () => {
            p.capital -= 6;
            return cross(0, L(`${The(p)} spent 6 ⭐ on an emergency party congress and won the rebels back.`, `${The(p)} gastou 6 ⭐ num congresso de emergência e reconquistou os rebeldes.`));
          },
        },
      ],
      { event: card },
    );
  }

  private async applyEvent(p: Player, ev: EventDef, subtitle: string): Promise<void> {
    const d = ev.delta(p);
    const view: EventCardView = { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: d < 0 ? 'bad' : 'good' };
    if (d < 0) {
      await this.hit(p, { ev: view, amount: -d, tags: ev.tags, options: ev.options });
    } else {
      this.view.spotlight(p.id);
      const got = this.gainPop(p, d);
      await this.tell(
        p,
        L(`got a lucky break: <i>${ev.name}</i>`, `teve um golpe de sorte: <i>${ev.name}</i>`),
        L(`${ev.flavor} ${The(p)}'s popularity changes by ${R.fmt(got)}.`, `${ev.flavor} A popularidade ${doP(p)} muda em ${R.fmt(got)}.`),
        'good',
        { event: view },
      );
    }
  }

  private async midterm(trigger: Player): Promise<void> {
    const ev = this.globals.next();
    const subtitle = L(`GLOBAL MIDTERM CRISIS · YEAR ${this.year}`, `CRISE GLOBAL DE MEIO DE MANDATO · ANO ${this.year}`);
    this.view.log(L(`${pn(trigger)} reaches the Midterm Convention first. <b>Global crisis: ${ev.name}!</b>`, `${pn(trigger)} chega primeiro à Convenção. <b>Crise global: ${ev.name}!</b>`), 'event');
    await this.view.drawCard('global', trigger.id, eventFace(L('GLOBAL CRISIS', 'CRISE GLOBAL'), ev));
    await this.view.story({
      headline: L(`Today, a national crisis broke out: <i>${ev.name}</i>.`, `Hoje, estourou uma crise nacional: <i>${ev.name}</i>.`),
      meaning: L(
        `${The(trigger)} reached the Midterm Convention first, so this global event now hits <b>every party</b>, depending on where they stand on the issues.`,
        `${The(trigger)} chegou primeiro à Convenção, então este evento global atinge <b>todos os partidos</b>, conforme a posição de cada um.`,
      ),
      tone: 'event',
      event: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'event' },
    });
    const winners: Player[] = [];
    const gains: string[] = [];
    for (const q of this.players) {
      const d = ev.delta(q);
      if (d < 0) {
        await this.hit(q, { ev: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'bad' }, amount: -d, tags: ev.tags, options: ev.options });
      } else if (d > 0) {
        winners.push(q);
        const got = this.gainPop(q, d);
        gains.push(L(`${The(q)} gains ${pop(got)}.`, `${The(q)} ganha ${pop(got)}.`));
      }
    }
    if (winners.length) {
      const many = winners.length > 1;
      await this.view.story({
        headline: L(`Today, ${and(winners.map(the))} came out of the <i>${ev.name}</i> stronger.`, `Hoje, ${and(winners.map(the))} ${many ? 'saíram' : 'saiu'} mais ${many ? 'fortes' : 'forte'} da crise: <i>${ev.name}</i>.`),
        meaning: L(
          `Where ${many ? 'these parties stand' : 'this party stands'} on the issue protected ${many ? 'them' : 'it'}, and voters rewarded that stance. ${gains.join(' ')}`,
          `A posição ${many ? 'desses partidos' : 'desse partido'} no tema ${many ? 'os protegeu' : 'o protegeu'}, e os eleitores recompensaram. ${gains.join(' ')}`,
        ),
        tone: 'good',
        event: { title: ev.name, subtitle, flavor: ev.flavor, text: ev.text, tone: 'good' },
      });
    }
    this.view.refresh();
  }

  private async lobby(p: Player): Promise<void> {
    const lb = this.lobbies.next();
    const l = R.lean(p.party.axes[lb.axis]);
    const aligned = l === lb.side;
    const pole = lb.side === 'low' ? AXIS_INFO[lb.axis].low : AXIS_INFO[lb.axis].high;
    const penalty = l === 'balanced' ? Math.ceil(lb.penalty / 2) : lb.penalty;
    const ev: EventCardView = { title: lb.name, subtitle: LABEL_LOBBY, flavor: lb.flavor, text: lobbyText(lb), tone: aligned ? 'good' : 'event' };
    await this.view.drawCard('lobby', p.id, eventFace(LABEL_LOBBY, { name: lb.name, flavor: lb.flavor, text: ev.text }));

    if (aligned) {
      await this.menu(
        p,
        lb.name,
        L('This interest group shares your values and offers its backing.', 'Este grupo de interesse compartilha seus valores e oferece apoio.'),
        [
          {
            opt: { label: L('Accept their backing', 'Aceitar o apoio'), detail: L(`+${lb.capital} ⭐ Political Capital`, `+${lb.capital} ⭐ de Capital Político`), ai: lb.capital * W_CAP },
            run: async () => {
              const g = this.gainCapital(p, lb.capital);
              await this.tell(
                p,
                L(`accepted the backing of the ${lb.name}`, `aceitou o apoio: ${lb.name}`),
                L(
                  `The ${lb.name} wants ${pole}, which ${the(p)} also stands for, so ${the(p)}'s supporters don't mind: ${the(p)} gains ${g} ⭐ Political Capital.`,
                  `${lb.name} quer ${pole}, que ${the(p)} também defende, então os apoiadores ${doP(p)} não se importam: ${the(p)} ganha ${g} ⭐ de Capital Político.`,
                ),
                'good',
                { event: ev },
              );
            },
          },
          {
            opt: { label: L('Politely decline', 'Recusar educadamente'), ai: -1 },
            run: () =>
              this.tell(p, L(`turned down the ${lb.name}`, `recusou o apoio: ${lb.name}`), L(`${The(p)} keeps the ${lb.name} at arm’s length, and nothing changes.`, `${The(p)} mantém distância, e nada muda.`), 'info', { event: ev }),
          },
        ],
        { event: ev },
      );
    } else {
      await this.menu(
        p,
        lb.name,
        L(`This group's agenda clashes with your base. Taking their money will cost you <b>${penalty}</b> popularity.`, `A pauta deste grupo bate de frente com sua base. Aceitar o dinheiro vai custar <b>${penalty}</b> de popularidade.`),
        [
          {
            opt: { label: L('Refuse the deal', 'Recusar o acordo'), ai: 0 },
            run: () =>
              this.tell(
                p,
                L(`refused money from the ${lb.name}`, `recusou o dinheiro: ${lb.name}`),
                L(
                  `The ${lb.name} wants ${pole}, which ${the(p)}'s supporters reject. By saying no, ${the(p)} stays clean and nothing changes.`,
                  `${lb.name} quer ${pole}, que os apoiadores ${doP(p)} rejeitam. Ao dizer não, ${the(p)} fica limpo e nada muda.`,
                ),
                'info',
                { event: ev },
              ),
          },
          {
            opt: { label: L('Take the deal anyway', 'Aceitar mesmo assim'), detail: L(`+${lb.capital} ⭐, −${penalty} popularity`, `+${lb.capital} ⭐, −${penalty} de popularidade`), ai: lb.capital * W_CAP - penalty },
            run: async () => {
              const g = this.gainCapital(p, lb.capital);
              const lost = this.gainPop(p, -penalty);
              await this.tell(
                p,
                L(`took money from the ${lb.name} anyway`, `aceitou o dinheiro mesmo assim: ${lb.name}`),
                L(
                  `${The(p)} pockets ${g}, but ${the(p)}'s supporters see it as a betrayal of what the party stands for: ${pop(lost)}.`,
                  `${The(p)} embolsa ${g} ⭐, mas os apoiadores ${doP(p)} veem nisso uma traição ao que o partido defende: ${pop(lost)}.`,
                ),
                'bad',
                { event: ev },
              );
            },
          },
        ],
        { event: ev },
      );
    }
  }

  private async committee(p: Player): Promise<void> {
    const interior = p.portfolios.includes('interior');
    const invCost = interior ? 1 : R.INVESTIGATE_COST;
    const invDmg = interior ? 6 : 4;
    const reportCap = interior ? 4 : 2;
    const entries: Entry[] = [
      {
        opt: { label: L('📝 Draft Committee Report', '📝 Redigir Relatório da Comissão'), detail: `+${reportCap} ⭐`, ai: reportCap * W_CAP },
        run: async () => {
          this.gainCapital(p, reportCap);
          await this.tell(
            p,
            L('decided to draft a committee report', 'decidiu redigir um relatório da comissão'),
            L(`Careful, unglamorous work: ${the(p)} earns +${reportCap} ⭐ Political Capital to spend later.`, `Trabalho cuidadoso e sem glamour: ${the(p)} ganha +${reportCap} ⭐ de Capital Político para gastar depois.`),
            'info',
          );
        },
      },
    ];
    const seen = new Set<string>();
    for (const c of p.hand) {
      if (c.kind !== 'scandal' || seen.has(c.key)) continue;
      seen.add(c.key);
      entries.push({
        opt: { label: L(`Leak: ${c.name}`, `Vazar: ${c.name}`), detail: L(`A rival loses ${c.power}+ popularity`, `Um rival perde ${c.power}+ de popularidade`), card: c, ai: c.power! * 0.5 + 1.5 - W_CARD * 0.4 },
        run: async () => {
          const target = await this.chooseRival(p, L(`Leak “${c.name}” against whom?`, `Vazar “${c.name}” contra quem?`));
          this.removeCard(p, c);
          const bonus = !p.inGov && target.inGov ? 3 : 0;
          const amount = c.power! + bonus;
          await this.tell(
            p,
            L(`leaked the <i>${c.name}</i> scandal against ${the(target)}`, `vazou o escândalo <i>${c.name}</i> contra ${the(target)}`),
            L(
              `${The(target)} stands to lose ${amount} popularity${bonus ? ' (including the opposition’s mudslinging bonus against the government)' : ''}. Now ${the(target)} must respond.`,
              `${The(target)} pode perder ${amount} de popularidade${bonus ? ' (incluindo o bônus da oposição por atacar o governo)' : ''}. Agora ${the(target)} precisa reagir.`,
            ),
            'bad',
            { card: c },
          );
          await this.hit(target, {
            ev: {
              title: c.name,
              subtitle: L(`SCANDAL LEAKED BY ${p.party.name.toUpperCase()}`, `ESCÂNDALO VAZADO POR ${p.party.name.toUpperCase()}`),
              flavor: c.text,
              text: L(
                `The leak threatens to cost ${target.party.name} ${c.power} popularity${bonus ? ', plus 3 more because the opposition is going after the government' : ''}, unless they can contain it.`,
                `O vazamento ameaça custar ${c.power} de popularidade a ${target.party.name}${bonus ? ', mais 3 porque a oposição está atacando o governo' : ''}, a menos que consigam contê-lo.`,
              ),
              tone: 'bad',
            },
            amount,
            tags: c.tags ?? ['scandal'],
            attack: true,
          });
        },
      });
    }
    entries.push({
      opt: {
        label: L('🔍 Launch Investigation', '🔍 Abrir Investigação'),
        detail: L(`${invCost} ⭐ → a rival loses ${invDmg} popularity`, `${invCost} ⭐ → um rival perde ${invDmg} de popularidade`),
        disabled: p.capital < invCost ? L('Not enough capital', 'Capital insuficiente') : undefined,
        ai: invDmg * 0.5 + 1 - invCost * W_CAP,
      },
      run: async () => {
        const target = await this.chooseRival(p, L('Investigate which party?', 'Investigar qual partido?'));
        p.capital -= invCost;
        await this.tell(
          p,
          L(`launched a committee investigation into ${the(target)}`, `abriu uma CPI contra ${the(target)}`),
          L(
            `${The(p)} spends ${invCost} ⭐ capital on subpoenas. ${The(target)} faces ${invDmg} popularity of damage and must respond.`,
            `${The(p)} gasta ${invCost} ⭐ de capital em convocações. ${The(target)} enfrenta ${invDmg} de dano à popularidade e precisa reagir.`,
          ),
          'bad',
        );
        await this.hit(target, {
          ev: {
            title: L('Committee Investigation', 'Investigação da Comissão'),
            subtitle: L(`LAUNCHED BY ${p.party.name.toUpperCase()}`, `ABERTA POR ${p.party.name.toUpperCase()}`),
            flavor: L('Subpoenas fly. Your officials are summoned to testify.', 'Chovem convocações. Seus dirigentes são chamados a depor.'),
            text: L(
              `A long public hearing that will cost ${target.party.name} ${invDmg} popularity unless they manage the fallout.`,
              `Uma longa audiência pública que vai custar ${invDmg} de popularidade a ${target.party.name}, a menos que controlem o estrago.`,
            ),
            tone: 'bad',
          },
          amount: invDmg,
          tags: ['scandal'],
          attack: true,
        });
      },
    });
    const nc = p.hand.find((c) => c.kind === 'noconfidence');
    if (nc && !p.inGov) {
      const opp = this.players.filter((q) => !q.inGov).reduce((s, q) => s + q.seats, 0);
      entries.push({
        opt: {
          label: L('⚖️ Vote of No Confidence', '⚖️ Moção de Desconfiança'),
          detail: L(`Opposition holds ${opp} seats (needs ${R.MAJORITY})`, `A oposição tem ${opp} cadeiras (precisa de ${R.MAJORITY})`),
          card: nc,
          ai: opp >= R.MAJORITY ? 9 : -5,
        },
        run: () => this.noConfidence(p, nc),
      });
    }
    await this.menu(p, L('Parliamentary Committee', 'Comissão Parlamentar'), L('Choose your committee business.', 'Escolha o trabalho na comissão.'), entries);
  }

  private async chooseRival(p: Player, title: string): Promise<Player> {
    const rivals = this.players.filter((q) => q !== p);
    const i = await this.ask(p, {
      title,
      options: rivals.map((q) => ({
        label: q.party.name,
        detail: L(
          `Popularity ${q.popularity} · ${q.seats} seats · ${q.isPM ? 'Prime Minister' : q.inGov ? 'Government' : 'Opposition'}`,
          `Popularidade ${q.popularity} · ${q.seats} cadeiras · ${q.isPM ? 'Primeiro-Ministro' : q.inGov ? 'Governo' : 'Oposição'}`,
        ),
        color: q.party.color,
        ai: q.popularity / 10 + (this.isLeader(q) ? 3 : 0) + (q.inGov && !p.inGov ? 1.5 : 0),
      })),
    });
    return rivals[i];
  }

  private async noConfidence(p: Player, card: Card): Promise<void> {
    this.removeCard(p, card);
    const opp = this.players.filter((q) => !q.inGov).reduce((s, q) => s + q.seats, 0);
    const pm = this.pm();
    const did = L('called a vote of no confidence in the government', 'apresentou uma moção de desconfiança contra o governo');
    if (opp >= R.MAJORITY && pm) {
      this.gainPop(pm, -5);
      await this.tell(
        p,
        did,
        L(
          `The opposition holds ${opp} seats, enough to win <b>${opp}–${R.TOTAL_SEATS - opp}</b>. The government of ${the(pm)} <b>falls</b> and ${the(pm)} loses 5 popularity. A new government must be formed.`,
          `A oposição tem ${opp} cadeiras, o suficiente para vencer por <b>${opp}–${R.TOTAL_SEATS - opp}</b>. O governo ${doP(pm)} <b>cai</b> e ${the(pm)} perde 5 de popularidade. Um novo governo precisa ser formado.`,
        ),
        'event',
        { card },
      );
      await this.formGovernment(pm.id);
    } else {
      const got = this.gainPop(p, -3);
      await this.tell(
        p,
        did,
        L(
          `The opposition only holds ${opp} seats, so the motion is <b>defeated</b> ${opp}–${R.TOTAL_SEATS - opp}. The failed stunt costs ${the(p)} ${pop(got)}.`,
          `A oposição só tem ${opp} cadeiras, então a moção é <b>derrotada</b> por ${opp}–${R.TOTAL_SEATS - opp}. A manobra fracassada custa ${pop(got)} ${aoP(p)}.`,
        ),
        'bad',
        { card },
      );
    }
  }

  private async debate(p: Player): Promise<void> {
    const rivals = this.players.filter((q) => q !== p);
    const adv = (q: Player, k: (typeof AXIS_KEYS)[number]) => Math.abs(q.party.axes[k] - this.mood[k]) - Math.abs(p.party.axes[k] - this.mood[k]);
    const ri = await this.ask(p, {
      title: L('National Debate — choose your opponent', 'Debate Nacional — escolha seu adversário'),
      body: L(
        'Pick a rival and a topic. Whoever is closer to the <b>Public Mood</b> on that axis wins +6 popularity; the loser drops 3.',
        'Escolha um rival e um tema. Quem estiver mais perto do <b>Humor do Eleitorado</b> nesse eixo ganha +6 de popularidade; quem perde cai 3.',
      ),
      options: rivals.map((q) => ({
        label: q.party.name,
        detail: L(`Popularity ${q.popularity}`, `Popularidade ${q.popularity}`),
        color: q.party.color,
        ai: Math.max(...AXIS_KEYS.map((k) => adv(q, k))) * 3 + q.popularity / 20,
      })),
    });
    const r = rivals[ri];
    const ki = await this.ask(p, {
      title: L(`Debate topic vs ${r.party.name}`, `Tema do debate contra ${r.party.name}`),
      body: L('The party closer to the Public Mood on this axis wins.', 'Vence o partido mais perto do Humor do Eleitorado nesse eixo.'),
      options: AXIS_KEYS.map((k) => ({
        label: AXIS_INFO[k].name,
        detail: L(`Mood ${this.mood[k].toFixed(1)} · You ${p.party.axes[k]} · Them ${r.party.axes[k]}`, `Humor ${this.mood[k].toFixed(1)} · Você ${p.party.axes[k]} · Eles ${r.party.axes[k]}`),
        ai: adv(r, k),
      })),
    });
    const k = AXIS_KEYS[ki];
    const topic = AXIS_INFO[k].name.toLowerCase();
    const did = L(`challenged ${the(r)} to a televised debate on ${topic} policy`, `desafiou ${the(r)} para um debate na TV sobre política ${topic}`);
    const dp = Math.abs(p.party.axes[k] - this.mood[k]);
    const dr = Math.abs(r.party.axes[k] - this.mood[k]);
    if (Math.abs(dp - dr) < 0.05) {
      this.gainPop(p, 2);
      this.gainPop(r, 2);
      await this.tell(
        p,
        did,
        L(
          `Both parties were equally close to the public mood (${this.mood[k].toFixed(1)}). The debate is a draw and both gain +2 popularity.`,
          `Os dois partidos estavam igualmente perto do humor do eleitorado (${this.mood[k].toFixed(1)}). O debate empata e ambos ganham +2 de popularidade.`,
        ),
        'info',
      );
    } else {
      const [win, lose] = dp < dr ? [p, r] : [r, p];
      this.gainPop(win, 6);
      this.gainPop(lose, -3);
      await this.tell(
        p,
        did,
        L(
          `On ${topic} policy the public mood sits at ${this.mood[k].toFixed(1)}. ${The(win)} was closer to it and <b>won the debate</b>: +6 popularity for ${the(win)}, −3 for ${the(lose)}.`,
          `Na política ${topic}, o humor do eleitorado está em ${this.mood[k].toFixed(1)}. ${The(win)} estava mais perto e <b>venceu o debate</b>: +6 de popularidade para ${the(win)}, −3 para ${the(lose)}.`,
        ),
        win === p ? 'good' : 'bad',
      );
    }
  }

  // ───────────────────────────── defense layers ─────────────────────────────

  /**
   * Resolve a popularity loss through the four defense layers:
   * ideological shield (already in `amount`), cabinet privileges, reaction cards, currency.
   */
  private async hit(p: Player, h: Hit): Promise<void> {
    let loss = h.amount;
    const tags = h.tags;
    const title = `<i>${h.ev.title}</i>`;
    const hitBy = L(`was hit by ${title}`, `foi atingido por ${title}`);
    this.view.spotlight(p.id);
    if (p.portfolios.includes('environment') && tags.includes('env')) {
      await this.tell(
        p,
        hitBy,
        L(`But as Minister of Environment, ${the(p)} is immune to environmental penalties: no damage at all.`, `Mas, com o Ministério do Meio Ambiente, ${the(p)} é imune a penalidades ambientais: nenhum dano.`),
        'gov',
        { event: h.ev },
      );
      return;
    }
    let shield = '';
    if (p.portfolios.includes('interior') && (tags.includes('scandal') || tags.includes('corruption'))) {
      loss = Math.ceil(loss / 2);
      shield = L(`As Minister of Interior, ${the(p)} quietly suppressed half of the investigation. `, `Com o Ministério do Interior, ${the(p)} abafou discretamente metade da investigação. `);
    }

    const settle = async (after: number, decided: string, how: string) => {
      const got = after > 0 ? this.gainPop(p, -after) : 0;
      const outcome = after > 0 ? L(`${how} ${The(p)} loses ${-got} popularity.`, `${how} ${The(p)} perde ${-got} de popularidade.`) : L(`${how} ${The(p)} loses no popularity at all.`, `${how} ${The(p)} não perde nada de popularidade.`);
      await this.tell(p, L(`${hitBy} and decided to ${decided}`, `${hitBy} e decidiu ${decided}`), shield + outcome, after > 0 ? 'bad' : 'good', { event: h.ev });
    };

    const noCap = L('Not enough capital', 'Capital insuficiente');
    const entries: Entry[] = [
      {
        opt: { label: L('Take the hit', 'Aceitar o golpe'), detail: L(`Lose ${loss} popularity`, `Perder ${loss} de popularidade`), ai: -loss },
        run: () => settle(loss, L('take the hit', 'aceitar o golpe'), L(`${The(p)} saves its money and influence for later.`, `${The(p)} guarda o capital para depois.`)),
      },
    ];

    const seen = new Set<string>();
    for (const c of p.hand) {
      if (c.kind !== 'reaction' || seen.has(c.key)) continue;
      seen.add(c.key);
      const use = () => this.removeCard(p, c);
      const play = L(`Play ${c.name}`, `Jogar ${c.name}`);
      const played = L(`play <i>${c.name}</i>`, `jogar <i>${c.name}</i>`);
      const cancels = (c.reaction === 'spin' && (tags.includes('scandal') || tags.includes('media'))) || (c.reaction === 'gag' && (tags.includes('scandal') || tags.includes('corruption')));
      if (cancels && h.attack) {
        const after = Math.ceil(loss / 2);
        entries.push({
          opt: { label: play, detail: L(`A rival's attack can't be killed outright: loss reduced to ${after}`, `Ataque de rival não se anula por completo: perda reduzida para ${after}`), card: c, ai: -after - W_CARD },
          run: () => {
            use();
            return settle(after, played, L('The card blunts the attack, but a rival’s leak cannot be buried completely.', 'A carta amortece o ataque, mas um vazamento de rival não pode ser abafado por completo.'));
          },
        });
      } else if (cancels) {
        entries.push({
          opt: { label: play, detail: L('Cancel the damage entirely', 'Cancela todo o dano'), card: c, ai: -W_CARD },
          run: () => {
            use();
            return settle(0, played, L('The card kills the story completely.', 'A carta enterra a história de vez.'));
          },
        });
      } else if (c.reaction === 'damage') {
        const after = Math.ceil(loss / 2);
        entries.push({
          opt: { label: play, detail: L(`Loss reduced to ${after}`, `Perda reduzida para ${after}`), card: c, ai: -after - W_CARD },
          run: () => {
            use();
            return settle(after, played, L('The card halves the damage.', 'A carta corta o dano pela metade.'));
          },
        });
      } else if (c.reaction === 'bailout' && !h.attack) {
        const cost = Math.ceil(loss / 2);
        entries.push({
          opt: { label: play, detail: L(`Pay ${cost} ⭐ instead of losing popularity`, `Pagar ${cost} ⭐ em vez de perder popularidade`), card: c, disabled: p.capital < cost ? noCap : undefined, ai: -cost * W_CAP - W_CARD },
          run: () => {
            use();
            p.capital -= cost;
            return settle(0, played, L(`${The(p)} pays ${cost} ⭐ capital to make the problem go away.`, `${The(p)} paga ${cost} ⭐ de capital para o problema sumir.`));
          },
        });
      }
    }

    const mits: Mitigation[] = h.options ?? [
      { label: L('Hire a PR Team', 'Contratar uma Equipe de RP'), cost: Math.max(1, Math.round(loss * 0.4)), lossMult: 0.5 },
      { label: L('Call in Favours', 'Cobrar Favores'), cost: Math.ceil(loss / 3) + 1, lossMult: 0 },
    ];
    for (const m of mits) {
      const after = m.reduceTo !== undefined ? Math.min(loss, m.reduceTo) : Math.ceil(loss * (m.lossMult ?? 1));
      const gain = m.gain ?? 0;
      const c = m.cost ?? 0;
      const cost = L(`${c} ⭐ capital`, `${c} ⭐ de capital`);
      if (h.attack && (after === 0 || gain)) continue; // a rival's attack can be softened, never escaped
      const res = gain ? L(`+${gain} popularity instead`, `+${gain} de popularidade em vez disso`) : after === 0 ? L('negate the loss', 'anula a perda') : L(`loss reduced to ${after}`, `perda reduzida para ${after}`);
      entries.push({
        opt: {
          label: m.label,
          detail: `${cost} → ${res}`,
          disabled: p.capital < c ? noCap : undefined,
          ai: gain - after - c * W_CAP - (c > 0 && p.capital - c < 3 ? 3 : 0),
        },
        run: async () => {
          p.capital -= c;
          if (gain) {
            const got = this.gainPop(p, gain);
            await this.tell(
              p,
              L(`${hitBy} and decided to ${m.label.toLowerCase()}`, `${hitBy} e decidiu ${m.label.toLowerCase()}`),
              L(`${shield}${The(p)} spends ${cost} and turns the crisis into a win: ${pop(got)}.`, `${shield}${The(p)} gasta ${cost} e transforma a crise em vitória: ${pop(got)}.`),
              'good',
              { event: h.ev },
            );
          } else {
            await settle(
              after,
              m.label.toLowerCase(),
              after === 0 ? L(`${The(p)} spends ${cost} and the problem goes away entirely.`, `${The(p)} gasta ${cost} e o problema some por completo.`) : L(`${The(p)} spends ${cost} to limit the damage.`, `${The(p)} gasta ${cost} para limitar o estrago.`),
            );
          }
        },
      });
    }

    await this.menu(
      p,
      h.ev.title,
      L(
        `You stand to lose <b>${loss}</b> popularity.${h.attack ? ' This is an attack by a rival party: you can soften it, but not escape it completely.' : ''} How do you respond?`,
        `Você pode perder <b>${loss}</b> de popularidade.${h.attack ? ' É um ataque de um partido rival: dá para amortecer, mas não escapar totalmente.' : ''} Como você reage?`,
      ),
      entries,
      { event: h.ev },
    );
    this.view.refresh();
  }

  // ───────────────────────────── elections & government ─────────────────────────────

  private async election(trigger: Player): Promise<void> {
    for (const q of this.players) {
      if (q.isPM) q.stats.pmYears++;
      else if (q.inGov) q.stats.cabinetYears++;
    }
    this.electionsHeld++;
    this.view.log(L(`<b>🗳️ General Election — end of Year ${this.electionsHeld}</b>, triggered by ${pn(trigger)}.`, `<b>🗳️ Eleição Geral — fim do Ano ${this.electionsHeld}</b>, convocada por ${pn(trigger)}.`), 'event');
    await this.view.banner(
      L(`🗳️ General Election — Year ${this.electionsHeld}`, `🗳️ Eleição Geral — Ano ${this.electionsHeld}`),
      L(`${trigger.party.name} completes the year. The nation goes to the polls!`, `${trigger.party.name} completa o ano. O país vai às urnas!`),
      'event',
    );

    // Last-minute swing toward parties close to the public mood.
    const mood = new Map<Player, number>();
    for (const q of this.players) {
      const b = R.clamp(Math.round(3 - 2 * R.partyDistance(q.party.axes, this.mood)), -3, 3);
      mood.set(q, b ? this.gainPop(q, b) : 0);
    }

    // Vote share = a party's popularity ÷ everyone's popularity; seats = share × 150 (largest remainder).
    const totalPop = this.players.reduce((s, q) => s + Math.max(q.popularity, 0.01), 0);
    const before = this.players.map((q) => q.seats);
    const seats = R.allocateSeats(this.players.map((q) => Math.max(q.popularity, 0.01)));
    this.players.forEach((q, i) => (q.seats = seats[i]));
    const yearWinner = [...this.players].sort((a, b) => b.seats - a.seats || b.popularity - a.popularity || a.id - b.id)[0];
    yearWinner.stats.electionWins++;
    const result: ElectionResult = {
      year: this.electionsHeld,
      final: this.electionsHeld >= R.YEARS,
      winnerId: yearWinner.id,
      totalPopularity: totalPop,
      rows: this.players.map((q, i) => ({
        playerId: q.id,
        popularity: q.popularity,
        share: (Math.max(q.popularity, 0.01) / totalPop) * 100,
        seatsBefore: before[i],
        seatsAfter: q.seats,
        moodBonus: mood.get(q) ?? 0,
      })),
    };
    await this.view.electionNight(result);
    this.view.seatsChanged();
    for (const q of this.players) this.gainCapital(q, 3 + Math.floor(q.seats / 25));
    this.view.refresh();
    const summary = [...this.players].sort((a, b) => b.seats - a.seats).map((q) => `${pn(q)} <b>${q.seats}</b>`).join(' · ');
    this.view.log(
      L(
        `Election results, Year ${this.electionsHeld}: ${summary}. ${pn(yearWinner)} wins the election (${yearWinner.stats.electionWins} so far).`,
        `Resultado da eleição, Ano ${this.electionsHeld}: ${summary}. ${pn(yearWinner)} vence a eleição (${yearWinner.stats.electionWins} até agora).`,
      ),
      'event',
    );

    const winner = this.players.find((q) => q.seats >= R.MAJORITY);
    if (winner) {
      await this.view.banner(L('ABSOLUTE MAJORITY!', 'MAIORIA ABSOLUTA!'), L(`${winner.party.name} wins ${winner.seats} seats and governs alone.`, `${winner.party.name} conquista ${winner.seats} cadeiras e governa sozinho.`), 'good');
      return this.finish('majority', winner);
    }
    if (this.electionsHeld >= R.YEARS) {
      await this.view.banner(L('The Final Election', 'A Eleição Final'), L('Five years have passed. The party that won the most elections takes the game.', 'Cinco anos se passaram. O partido que venceu mais eleições leva o jogo.'), 'event');
      return this.finish('prestige');
    }

    // The new government is formed on this election's results; only then does the new year start.
    await this.formGovernment();

    // A fresh year: everyone's popularity resets so each election is decided by that year's politics.
    for (const k of AXIS_KEYS) this.mood[k] = Math.round(R.clamp(this.mood[k] + (Math.random() - 0.5) * 0.8, 1, 4) * 10) / 10;
    for (const q of this.players) q.popularity = R.START_POPULARITY;
    this.view.refresh();
    await this.view.story({
      headline: L('Today, a new political year began.', 'Hoje começou um novo ano político.'),
      meaning: L(
        `Every party's popularity resets to <b>${R.START_POPULARITY}</b>, so next year's election is decided by what happens from now on. Seats, laws passed, ⭐ capital and election wins carry over. The public mood has shifted too.`,
        `A popularidade de todos os partidos volta para <b>${R.START_POPULARITY}</b>, então a próxima eleição será decidida pelo que acontecer daqui em diante. Cadeiras, leis aprovadas, ⭐ capital e vitórias eleitorais continuam valendo. O humor do eleitorado também mudou.`,
      ),
      tone: 'info',
    });
    this.yearStartPerks();
    this.view.log(L(`<b>Year ${this.year} begins.</b>`, `<b>Começa o Ano ${this.year}.</b>`), 'turn');
  }

  private yearStartPerks(): void {
    for (const q of this.players) {
      if (q.portfolios.includes('information') && this.draw(q, 1).length) {
        this.view.log(L(`${pn(q)} draws an extra card (Minister of Information).`, `${pn(q)} compra uma carta extra (Ministério da Comunicação).`), 'gov');
      }
      if (q.portfolios.includes('economy')) {
        const g = this.gainCapital(q, 2);
        this.view.log(L(`${pn(q)} receives a ${g} ⭐ ministry budget (Minister of Economy).`, `${pn(q)} recebe um orçamento de ${g} ⭐ (Ministério da Economia).`), 'gov');
      }
    }
    this.view.refresh();
  }

  /** Each tied party spins; the highest number wins the mandate (ties at the top spin again). Returns the mandate order. */
  private async mandateRollOff(cands: Player[], why: string): Promise<Player[]> {
    this.view.log(L(`<b>Mandate roll-off!</b> ${why}`, `<b>Disputa pelo mandato!</b> ${why}`), 'event');
    await this.view.banner(L('🎡 Mandate Roll-Off', '🎡 Disputa pelo Mandato'), why, 'gov');
    const firstRoll = new Map<Player, number>();
    let pool = cands;
    while (pool.length > 1) {
      const rolls = new Map<Player, number>();
      for (const q of pool) {
        this.view.setActive(q.id);
        await this.view.turnStart(q.id);
        await this.ask(q, {
          title: L('Spin for the mandate', 'Gire pelo mandato'),
          body: L('Parliament is tied. The party with the highest spin receives the mandate to form a government.', 'O parlamento está empatado. O partido com o maior número recebe o mandato para formar o governo.'),
          options: [{ label: L('🎡 Spin for the Mandate', '🎡 Girar pelo Mandato'), ai: 1 }],
          spin: true,
          mode: 'bar',
        });
        const roll = 1 + Math.floor(Math.random() * 10);
        await this.view.spin(roll);
        rolls.set(q, roll);
        if (!firstRoll.has(q)) firstRoll.set(q, roll);
        await this.view.story({
          actorId: q.id,
          headline: L(`Today, ${the(q)} spun a <b>${roll}</b> for the mandate.`, `Hoje, ${the(q)} tirou <b>${roll}</b> na disputa pelo mandato.`),
          meaning: this.rollOffStanding(pool, rolls, q),
          tone: 'gov',
        });
      }
      const best = Math.max(...rolls.values());
      const top = pool.filter((q) => rolls.get(q) === best);
      if (top.length > 1) {
        await this.view.story({ headline: L(`Another tie at ${best}!`, `Novo empate em ${best}!`), meaning: L(`${and(top.map(The))} must spin again.`, `${and(top.map(The))} precisam girar de novo.`), tone: 'event' });
      }
      pool = top;
    }
    const winner = pool[0];
    await this.tell(
      winner,
      L('won the race for the mandate', 'venceu a disputa pelo mandato'),
      L('With the highest spin, they get the first chance to build a government.', 'Com o maior número, o partido tem a primeira chance de formar o governo.'),
      'gov',
    );
    const rest = cands.filter((q) => q !== winner).sort((a, b) => firstRoll.get(b)! - firstRoll.get(a)!);
    return [winner, ...rest];
  }

  /** "The X takes the lead with a 9. Still to spin: …" after `just` has spun in a mandate roll-off. */
  private rollOffStanding(pool: Player[], rolls: Map<Player, number>, just: Player): string {
    const best = Math.max(...rolls.values());
    const leaders = pool.filter((q) => rolls.get(q) === best);
    const waiting = pool.filter((q) => !rolls.has(q));
    let lead: string;
    if (leaders.length > 1) lead = L(`${and(leaders.map(The))} are <b>tied for the lead</b> with a ${best}.`, `${and(leaders.map(The))} estão <b>empatados na liderança</b> com ${best}.`);
    else if (leaders[0] === just)
      lead = rolls.size === 1 ? L(`${The(just)} sets the mark to beat: <b>${best}</b>.`, `${The(just)} define a marca a ser batida: <b>${best}</b>.`) : L(`${The(just)} <b>takes the lead</b> with a ${best}!`, `${The(just)} <b>assume a liderança</b> com ${best}!`);
    else lead = L(`${The(leaders[0])} is still <b>in the lead</b> with a ${best}.`, `${The(leaders[0])} continua <b>na liderança</b> com ${best}.`);
    const next = waiting.length
      ? L(` Still to spin: ${waiting.map(the).join(', ')}.`, ` Ainda vão girar: ${waiting.map(the).join(', ')}.`)
      : leaders.length > 1
        ? L(' Everyone has spun, so the tied parties spin again.', ' Todos já giraram, então os empatados giram de novo.')
        : L(` Everyone has spun: ${the(leaders[0])} wins the mandate.`, ` Todos já giraram: ${the(leaders[0])} fica com o mandato.`);
    return lead + next;
  }

  /** `opening`: the first government of the game, when every party spins for the mandate. */
  private async formGovernment(excludeId = -1, opening = false): Promise<void> {
    for (const q of this.players) {
      q.isPM = false;
      q.inGov = false;
      q.portfolios = [];
    }
    this.view.seatsChanged();
    // Most seats first; a seat tie goes to the more popular party (the one that won more votes).
    let ranking = [...this.players].filter((q) => q.id !== excludeId).sort((a, b) => b.seats - a.seats || b.popularity - a.popularity);
    // At the opening every party spins for the mandate; later, only parties tied on both seats and popularity do.
    const top = ranking[0];
    const tied = opening ? ranking : ranking.filter((q) => q.seats === top.seats && q.popularity === top.popularity);
    if (tied.length > 1) {
      const order = await this.mandateRollOff(
        tied,
        opening
          ? L('Parliament is evenly split, so every party spins the wheel. The highest number receives the mandate.', 'O parlamento está dividido igualmente, então todos os partidos giram a roleta. O maior número recebe o mandato.')
          : L(`${tied.length} parties are tied on ${tied[0].seats} seats. Each spins the wheel; the highest number receives the mandate.`, `${tied.length} partidos estão empatados com ${tied[0].seats} cadeiras. Cada um gira a roleta; o maior número recebe o mandato.`),
      );
      ranking = [...order, ...ranking.filter((q) => !tied.includes(q))];
    }

    for (const f of ranking) {
      this.view.setActive(f.id);
      this.view.spotlight(f.id);
      await this.tell(
        f,
        L('received the mandate to form a government', 'recebeu o mandato para formar o governo'),
        f.seats >= R.MAJORITY
          ? L(`With ${f.seats} seats they already hold a majority.`, `Com ${f.seats} cadeiras, o partido já tem maioria.`)
          : L(
              `They hold ${f.seats} seats but need <b>${R.MAJORITY}</b>, so they must invite other parties into a coalition by offering cabinet posts.`,
              `O partido tem ${f.seats} cadeiras mas precisa de <b>${R.MAJORITY}</b>, então precisa convidar outros partidos para uma coalizão oferecendo ministérios.`,
            ),
        'gov',
      );
      const deal = await this.negotiate(f);
      if (deal) return this.install(f, deal);
      await this.tell(f, L('failed to build a majority', 'não conseguiu formar maioria'), L('Too many parties said no. The mandate passes to the next party in line.', 'Muitos partidos disseram não. O mandato passa para o próximo da fila.'), 'bad');
    }
    const f = ranking[0];
    await this.tell(
      f,
      L('formed a minority government', 'formou um governo de minoria'),
      L('No coalition could reach 76 seats, so the largest party governs alone and will struggle to pass bills.', 'Nenhuma coalizão chegou a 76 cadeiras, então o maior partido governa sozinho e terá dificuldade para aprovar leis.'),
      'gov',
    );
    await this.install(f, { partners: [], assign: new Map(), transfers: [] }, true);
  }

  private acceptValue(partner: Player, f: Player, sweetener: number): number {
    const d = R.partyDistance(partner.party.axes, f.party.axes);
    let v = 3 - d * 2.2 + sweetener / 3;
    if (this.isLeader(partner)) v -= 1; // front-runners prefer the freedom of opposition
    return v;
  }

  private async negotiate(f: Player): Promise<Deal | null> {
    const deal: Deal = { partners: [], assign: new Map(), transfers: [] };
    if (f.seats >= R.MAJORITY) return deal;
    const coalition: Player[] = [f];
    const left = [...PORTFOLIOS];
    const approached = new Set<number>();
    let rejections = 0;
    let budget = f.capital;
    const bloc = () => coalition.reduce((s, q) => s + q.seats, 0);

    while (bloc() < R.MAJORITY && left.length && rejections < 3) {
      const cands = this.players.filter((q) => !coalition.includes(q) && !approached.has(q.id));
      if (!cands.length) break;
      const cur = bloc();
      const ci = await this.ask(f, {
        title: L('Coalition talks — you hold the mandate', 'Negociação da coalizão — o mandato é seu'),
        body: L(
          `Your bloc holds <b>${cur}</b> seats; <b>${R.MAJORITY}</b> are needed. Invite a party into government.${rejections ? ` <i>(${rejections}/3 rejections so far)</i>` : ''}`,
          `Seu bloco tem <b>${cur}</b> cadeiras; são necessárias <b>${R.MAJORITY}</b>. Convide um partido para o governo.${rejections ? ` <i>(${rejections}/3 recusas até agora)</i>` : ''}`,
        ),
        options: [
          ...cands.map((q) => {
            const d = R.partyDistance(f.party.axes, q.party.axes);
            return {
              label: L(`Invite ${q.party.name}`, `Convidar ${q.party.name}`),
              detail: L(`${q.seats} seats · ideological distance ${d.toFixed(1)} · bloc → ${cur + q.seats}`, `${q.seats} cadeiras · distância ideológica ${d.toFixed(1)} · bloco → ${cur + q.seats}`),
              color: q.party.color,
              ai: q.seats / 8 - d * 2 + (cur + q.seats >= R.MAJORITY ? 3 : 0),
            };
          }),
          { label: L('Give up the mandate', 'Desistir do mandato'), ai: -20 },
        ],
      });
      if (ci >= cands.length) return null;
      const partner = cands[ci];

      const pfi = await this.ask(f, {
        title: L(`Offer a cabinet portfolio to ${partner.party.name}`, `Oferecer um ministério a ${partner.party.name}`),
        options: left.map((pf) => ({ label: `${PORTFOLIO_INFO[pf].icon} ${PORTFOLIO_INFO[pf].title}`, detail: PORTFOLIO_INFO[pf].perk, ai: -PF_VALUE[pf] })),
      });
      const pf = left[pfi];

      const sweets = [0, 4, 8].filter((s) => s <= budget);
      const si =
        sweets.length > 1
          ? await this.ask(f, {
              title: L('Sweeten the deal?', 'Adoçar o acordo?'),
              body: L(`Give ⭐ Political Capital to ${partner.party.name} if they join your government.`, `Dê ⭐ Capital Político a ${partner.party.name} se entrar no seu governo.`),
              options: sweets.map((s) => ({ label: s ? L(`Offer ${s} ⭐`, `Oferecer ${s} ⭐`) : L('No sweetener', 'Sem agrado'), ai: (this.acceptValue(partner, f, s) > 0.3 ? 10 : 0) - s * 0.5 })),
            })
          : 0;
      const s = sweets[si];
      const offer = L(`the post of ${PORTFOLIO_INFO[pf].title}${s ? ` and ${s} ⭐ capital` : ''}`, `o ${PORTFOLIO_INFO[pf].title}${s ? ` e ${s} ⭐ de capital` : ''}`);

      const noise = (Math.random() - 0.5) * 0.8;
      const answer = await this.ask(partner, {
        title: L(`${f.party.name} invites you into government`, `${f.party.name} convida você para o governo`),
        body: L(
          `Offer: <b>${PORTFOLIO_INFO[pf].title}</b> (${PORTFOLIO_INFO[pf].perk})${s ? ` plus <b>${s} ⭐ capital</b>` : ''}. The coalition would hold ${cur + partner.seats} seats.`,
          `Oferta: <b>${PORTFOLIO_INFO[pf].title}</b> (${PORTFOLIO_INFO[pf].perk})${s ? ` e mais <b>${s} ⭐ de capital</b>` : ''}. A coalizão teria ${cur + partner.seats} cadeiras.`,
        ),
        options: [
          { label: L('Accept — join the coalition', 'Aceitar — entrar na coalizão'), ai: this.acceptValue(partner, f, s) + noise },
          { label: L('Decline — stay in opposition', 'Recusar — ficar na oposição'), ai: 0 },
        ],
      });
      if (answer === 0) {
        coalition.push(partner);
        left.splice(pfi, 1);
        deal.assign.set(pf, partner);
        if (s) {
          deal.transfers.push({ to: partner, amount: s });
          budget -= s;
        }
        const now = bloc();
        await this.tell(
          f,
          L(`offered ${the(partner)} ${offer}`, `ofereceu ${aoP(partner)} ${offer}`),
          L(
            `${The(partner)} <b>accepted</b> and joins the coalition. The coalition now holds ${now} seats${now >= R.MAJORITY ? ' — a majority!' : `; it still needs ${R.MAJORITY - now} more.`}`,
            `${The(partner)} <b>aceitou</b> e entra na coalizão. A coalizão agora tem ${now} cadeiras${now >= R.MAJORITY ? ' — maioria!' : `; ainda faltam ${R.MAJORITY - now}.`}`,
          ),
          'gov',
        );
      } else {
        rejections++;
        approached.add(partner.id);
        await this.tell(
          f,
          L(`offered ${the(partner)} ${offer}`, `ofereceu ${aoP(partner)} ${offer}`),
          L(`${The(partner)} <b>said no</b> and prefers to stay in opposition. (${rejections}/3 rejections)`, `${The(partner)} <b>recusou</b> e prefere ficar na oposição. (${rejections}/3 recusas)`),
          'bad',
        );
      }
    }
    if (bloc() >= R.MAJORITY) {
      deal.partners = coalition.slice(1);
      return deal;
    }
    return null;
  }

  private async install(f: Player, deal: Deal, minority = false): Promise<void> {
    this.rebellions.clear(); // a new government starts with a clean slate
    f.isPM = true;
    f.inGov = true;
    for (const q of deal.partners) q.inGov = true;
    for (const pf of PORTFOLIOS) (deal.assign.get(pf) ?? f).portfolios.push(pf);
    for (const t of deal.transfers) {
      const amt = Math.min(t.amount, f.capital);
      f.capital -= amt;
      t.to.capital += amt;
    }
    f.capital += 4;
    for (const q of deal.partners) q.capital += 2;
    const seats = f.seats + deal.partners.reduce((s, q) => s + q.seats, 0);
    this.view.seatsChanged();
    this.view.log(L(`${pn(f)} forms a government (${seats} seats). <b>Prime Minister: ${f.party.name}</b>.`, `${pn(f)} forma o governo (${seats} cadeiras). <b>Primeiro-Ministro: ${f.party.name}</b>.`), 'gov');
    await this.view.pmTakesSeat(f.id);
    if (!minority) await this.announceGovernment(f, deal, seats);
    await this.announceOpposition(seats);
  }

  private async announceGovernment(f: Player, deal: Deal, seats: number): Promise<void> {
    const ministers = this.players
      .filter((q) => q.portfolios.length)
      .map((q) => `${the(q)}: ${q.portfolios.map((pf) => PORTFOLIO_INFO[pf].short).join(', ')}`)
      .join('; ');
    await this.tell(
      f,
      L('formed a new government', 'formou um novo governo'),
      L(
        `They become <b>Prime Minister</b>${deal.partners.length ? ` in coalition with ${and(deal.partners.map(the))}` : ''}, with ${seats} of ${R.TOTAL_SEATS} seats. Ministries — ${ministers}. Everyone else sits in opposition.`,
        `O partido assume o cargo de <b>Primeiro-Ministro</b>${deal.partners.length ? ` em coalizão com ${and(deal.partners.map(the))}` : ''}, com ${seats} de ${R.TOTAL_SEATS} cadeiras. Ministérios — ${ministers}. Todos os demais ficam na oposição.`,
      ),
      'gov',
    );
  }

  /** Once the government is seated, the opposition forms behind its leader: the largest party left outside. */
  private async announceOpposition(govSeats: number): Promise<void> {
    const leader = R.oppositionLeader(this.players);
    if (!leader) return;
    const members = this.players.filter((q) => !q.inGov && q.seats > 0).sort((a, b) => b.seats - a.seats);
    const others = members.filter((q) => q !== leader);
    const oppSeats = members.reduce((s, q) => s + q.seats, 0);
    await this.view.oppositionForms(leader.id, members.map((q) => q.id));
    const joined = others.length
      ? L(`, joined on the opposition benches by ${and(others.map(the))}`, `, ao lado de ${and(others.map(the))} nos bancos da oposição`)
      : L(', alone on the opposition benches', `, ${art(leader.party) === 'a' ? 'sozinha' : 'sozinho'} nos bancos da oposição`);
    await this.tell(
      leader,
      L('became the Leader of the Opposition', 'assumiu a Liderança da Oposição'),
      L(
        `As the largest party outside the government (${leader.seats} seats), ${the(leader)} leads the opposition${joined}. ${others.length ? 'Together they hold' : 'It holds'} <b>${oppSeats}</b> seats against the government's <b>${govSeats}</b>. Their job: block bills with vetoes, investigate the government (leaks against it hit 3 harder) and bring it down with a vote of no confidence if they ever reach ${R.MAJORITY} seats.`,
        `Como maior partido fora do governo (${leader.seats} cadeiras), ${the(leader)} lidera a oposição${joined}. ${others.length ? 'Juntos, têm' : 'O partido tem'} <b>${oppSeats}</b> cadeiras contra <b>${govSeats}</b> do governo. A missão: barrar projetos com vetos, investigar o governo (vazamentos contra ele custam 3 a mais) e derrubá-lo com uma moção de desconfiança se um dia chegarem a ${R.MAJORITY} cadeiras.`,
      ),
      'event',
    );
  }

  /** Governance Score: the tiebreak between parties with the same number of election wins. */
  governance(q: Player): number {
    const s = q.stats;
    return s.pmYears * 15 + s.cabinetYears * 6 + s.billsPassed * 8 + q.seats;
  }

  /** Overall standings: most elections won, then Governance Score. */
  standings(): Player[] {
    return [...this.players].sort((a, b) => b.stats.electionWins - a.stats.electionWins || this.governance(b) - this.governance(a) || a.id - b.id);
  }

  private finish(kind: GameResult['kind'], winner?: Player): void {
    const rows: ScoreRow[] = this.standings().map((q) => {
      const s = q.stats;
      return {
        player: q,
        wins: s.electionWins,
        score: this.governance(q),
        detail: L(
          `${s.pmYears} PM yrs ×15 · ${s.cabinetYears} cabinet yrs ×6 · ${s.billsPassed} laws passed ×8 · ${q.seats} seats`,
          `${s.pmYears} anos como PM ×15 · ${s.cabinetYears} anos no gabinete ×6 · ${s.billsPassed} leis aprovadas ×8 · ${q.seats} cadeiras`,
        ),
      };
    });
    this.result = { kind, winner: winner ?? rows[0].player, rows };
    this.over = true;
    this.view.log(L(`<b>GAME OVER.</b> ${pn(this.result.winner)} wins!`, `<b>FIM DE JOGO.</b> ${pn(this.result.winner)} vence!`), 'event');
    this.view.gameOver(this.result);
  }

  // ───────────────────────────── helpers ─────────────────────────────

  /** "Today, the <party> <did>." / "This means …" — shown centre-screen, and kept in the history log. */
  private async tell(p: Player, did: string, meaning: string, tone: Tone, extra: Partial<Story> = {}): Promise<void> {
    const headline = L(`Today, ${the(p)} ${did}.`, `Hoje, ${the(p)} ${did}.`);
    this.view.log(`${headline} ${meaning}`, tone);
    this.view.refresh();
    await this.view.story({ actorId: p.id, headline, meaning, tone, ...extra });
  }

  private ask(p: Player, prompt: Omit<Prompt, 'playerId'>): Promise<number> {
    return this.controllers[p.id].choose({ ...prompt, playerId: p.id });
  }

  private async menu(p: Player, title: string, body: string, entries: Entry[], extra: Partial<Prompt> = {}): Promise<number> {
    const i = await this.ask(p, { title, body, options: entries.map((e) => e.opt), ...extra });
    await entries[i].run?.();
    this.view.refresh();
    return i;
  }

  /** Applies a popularity change, scaled by approval saturation (see R.scalePopularity). Returns the actual change. */
  private gainPop(p: Player, amt: number): number {
    const before = p.popularity;
    p.popularity = R.clamp(p.popularity + R.scalePopularity(amt, p.popularity), 0, 100);
    const got = p.popularity - before;
    if (got) this.view.popChanged(p.id, got);
    return got;
  }

  /** Adds ⭐ Political Capital; the Minister of Economy earns +1 on every income. Returns the amount gained. */
  private gainCapital(p: Player, amt: number): number {
    if (amt > 0 && p.portfolios.includes('economy')) amt += 1;
    p.capital = Math.max(0, p.capital + amt);
    return amt;
  }

  private isLeader(p: Player): boolean {
    return p.popularity >= Math.max(...this.players.map((q) => q.popularity));
  }

  private removeCard(p: Player, c: Card): void {
    const i = p.hand.indexOf(c);
    if (i >= 0) p.hand.splice(i, 1);
    (c.kind === 'bill' ? this.lawDiscard : this.strategyDiscard).push(c);
  }

  /** Top card of the LAW or STRATEGY deck (reshuffling its discard pile when empty). */
  private drawOne(kind: 'law' | 'strategy'): Card | undefined {
    if (kind === 'law') {
      if (!this.laws.length) [this.laws, this.lawDiscard] = [R.shuffle(this.lawDiscard), []];
      return this.laws.pop();
    }
    if (!this.strategy.length) [this.strategy, this.strategyDiscard] = [R.shuffle(this.strategyDiscard), []];
    return this.strategy.pop();
  }

  /** Draw from the STRATEGY deck into a hand (respecting the hand limit). */
  private draw(p: Player, n: number): Card[] {
    const got: Card[] = [];
    for (let i = 0; i < n && p.hand.length < R.HAND_LIMIT; i++) {
      const c = this.drawOne('strategy');
      if (!c) break;
      p.hand.push(c);
      got.push(c);
    }
    return got;
  }

  private cardValue(p: Player, c: Card): number {
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
