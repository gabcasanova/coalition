/** What the engine exchanges with the presentation layer (3D scene + HUD). */
/** How a point was scored. */
export type PointKind = 'parliamentary' | 'presidential' | 'legislative';

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
  /** Points (parliamentary elections + presidencies won): the main ranking. */
  points: number;
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

/** One party's line on presidential election night. */
export interface PresidentialRow {
  playerId: number;
  popularity: number;
  /** Share of the national vote, in percent (it follows popularity). */
  share: number;
}

export interface PresidentialResult {
  year: number;
  winnerId: number;
  /** The previous President's party (−1: the Provisional President). */
  previousId: number;
  rows: PresidentialRow[];
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
  /** Deal each year's draft: `perPlayer` cards fly from the LAW deck to every pawn (the parties then keep some). */
  dealHands(perPlayer: number, year: number): Promise<void>;
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
  /** Like seatsChanged, but waits while the MPs grow into (or leave) their seats. */
  seatsGrow(): Promise<void>;
  /** Presidential election night on TV: the national count, in graphs. Resolves when the viewer continues. */
  presidentialNight(result: PresidentialResult): Promise<void>;
  /** The new President flies in by helicopter, climbs down to the carpet and takes the throne. */
  presidentTakesOffice(playerId: number): Promise<void>;
  /** A party has just scored a point (Congress, the presidency or Legislative MVP): it climbs the standings podium. */
  podiumWin(playerId: number, kind: PointKind): Promise<void>;
  /** A new Leader of Congress walks to their seat at the end of the chamber. */
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
