import { L } from './i18n';
export type AxisKey = 'econ' | 'social' | 'env' | 'inst';
/** Each axis runs 1..4 (low pole → high pole). 2.5 is "balanced". */
export type Axes = Record<AxisKey, number>;
export const AXIS_KEYS: readonly AxisKey[] = ['econ', 'social', 'env', 'inst'];

export const AXIS_INFO: Record<AxisKey, { name: string; low: string; high: string }> = {
  econ: { name: L('Economic', 'Econômico'), low: L('Interventionism', 'Intervencionismo'), high: L('Neoliberalism', 'Neoliberalismo') },
  social: { name: L('Social', 'Social'), low: L('Social Progressivism', 'Progressismo Social'), high: L('Social Conservatism', 'Conservadorismo Social') },
  env: { name: L('Environmental', 'Ambiental'), low: L('Developmentalism', 'Desenvolvimentismo'), high: L('Ecologism', 'Ecologismo') },
  inst: { name: L('Institutional', 'Institucional'), low: L('Direct Democracy', 'Democracia Direta'), high: L('Centralism', 'Centralismo') },
};

export interface PartyDef {
  name: string;
  short: string;
  /** Party emblem (an emoji), shown on panels, pawns and news. */
  icon: string;
  /** Portuguese grammatical gender of the name ("o"/"a"); guessed when missing. */
  article?: 'o' | 'a';
  tagline: string;
  color: number;
  axes: Axes;
}

export type Portfolio = 'economy' | 'information' | 'environment' | 'interior';
export const PORTFOLIOS: readonly Portfolio[] = ['economy', 'information', 'environment', 'interior'];
export const PORTFOLIO_INFO: Record<Portfolio, { title: string; short: string; icon: string; perk: string }> = {
  economy: {
    title: L('Minister of Economy', 'Ministério da Economia'),
    short: L('Economy', 'Economia'),
    icon: '💰',
    perk: L('+1 ⭐ on every capital income, +1 ⭐ on Media squares and a 2 ⭐ budget each year', '+1 ⭐ em toda renda de capital, +1 ⭐ nas casas de Mídia e um orçamento de 2 ⭐ por ano'),
  },
  information: {
    title: L('Minister of Information', 'Ministério da Comunicação'),
    short: L('Information', 'Comunicação'),
    icon: '📰',
    perk: L('+1 extra card draw at the start of every year', '+1 carta extra no início de cada ano'),
  },
  environment: {
    title: L('Minister of Environment', 'Ministério do Meio Ambiente'),
    short: L('Environment', 'Meio Ambiente'),
    icon: '🌿',
    perk: L('Immune to environmental crisis penalties', 'Imune às penalidades de crises ambientais'),
  },
  interior: {
    title: L('Minister of Interior', 'Ministério do Interior'),
    short: L('Interior', 'Interior'),
    icon: '🛡️',
    perk: L('Controls committee investigations (cheaper, stronger); scandal damage halved', 'Controla as investigações das comissões (mais baratas e fortes); dano de escândalos pela metade'),
  },
};

export type CardKind = 'bill' | 'scandal' | 'rally' | 'whip' | 'reaction' | 'noconfidence';
export type ReactionType = 'spin' | 'gag' | 'bailout' | 'damage';

export interface CardDef {
  key: string;
  kind: CardKind;
  name: string;
  text: string;
  /** Policy bills: the ideological position the bill embodies. */
  target?: Partial<Axes>;
  /** Scandal damage or rally popularity gain. */
  power?: number;
  /** Rally cost in Party Funds. */
  cost?: number;
  reaction?: ReactionType;
  tags?: string[];
}
export interface Card extends CardDef {
  uid: number;
}

export interface PlayerStats {
  pmYears: number;
  cabinetYears: number;
  billsPassed: number;
  billsIntroduced: number;
  /** Elections won (most seats that year): the main victory measure. */
  electionWins: number;
}

export interface Player {
  id: number;
  party: PartyDef;
  isAI: boolean;
  position: number;
  /** Has reached the Election square this year and is waiting for the other parties. */
  waiting: boolean;
  popularity: number;
  /** ⭐ Political Capital: the single currency (earned from lobbies, laws, office; spent on rallies, vetoes, fixes). */
  capital: number;
  seats: number;
  hand: Card[];
  portfolios: Portfolio[];
  isPM: boolean;
  inGov: boolean;
  stats: PlayerStats;
}

export type SquareType =
  | 'election'
  | 'formation'
  | 'midterm'
  | 'debate'
  | 'legislature'
  | 'media'
  | 'crisis'
  | 'lobby'
  | 'committee';

export type Tone = 'info' | 'good' | 'bad' | 'event' | 'gov' | 'turn';

export interface EventCardView {
  title: string;
  subtitle: string;
  flavor: string;
  /** What the card does, as a short narrative paragraph. */
  text: string;
  tone: Tone;
}

/** The physical card decks on the table. */
export type DeckKind = 'law' | 'media' | 'lobby' | 'crisis' | 'global' | 'strategy';

/** What is printed on the face of a drawn card (for the draw animation). */
export interface CardFace {
  label: string;
  title: string;
  flavor: string;
  /** What the card does, as a short narrative paragraph. */
  text: string;
}

export interface PromptOption {
  label: string;
  detail?: string;
  /** If set, the option is shown but cannot be picked; the string says why. */
  disabled?: string;
  /** Heuristic value used by AI players (higher = better for the chooser). */
  ai: number;
  card?: Card;
  color?: number;
}

export interface Prompt {
  playerId: number;
  title: string;
  body?: string;
  options: PromptOption[];
  /** 'bar' renders a slim action bar instead of a blocking dialog. */
  mode?: 'modal' | 'bar';
  /** A spin prompt: humans spin by clicking the roulette wheel itself. */
  spin?: boolean;
  event?: EventCardView;
  showCard?: Card;
}

/** Anything that can make decisions for a player: a human UI or an AI. */
export interface Controller {
  choose(prompt: Prompt): Promise<number>;
}
