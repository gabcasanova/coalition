/** What the engine exchanges with the presentation layer (3D scene + HUD). */
import type { DistrictResult } from '../electoral';
import {
  type Card,
  type CardFace,
  type DeckKind,
  type EventCardView,
  type PartyDef,
  type Player,
  type Tone,
} from '../types';

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
  /** National vote share in percent (all districts together). */
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
  rows: ElectionRow[];
  /** Results district by district (for the election-night map). */
  districts: DistrictResult[];
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
  /** Hop a pawn square by square; negative `steps` move it backwards. */
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
