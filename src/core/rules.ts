import { L } from './i18n';
import { AXIS_INFO, AXIS_KEYS, type Axes, type AxisKey } from './types';

export const BOARD_SIZE = 50;
export const TOTAL_SEATS = 150;
export const MAJORITY = 76;
export const YEARS = 5;
export const START_HAND = 7;
export const HAND_LIMIT = 10;

export const START_POPULARITY = 30;
export const START_CAPITAL = 15;

// Costs in ⭐ Political Capital
export const VETO_COST = 6;
export const WHIP_COST = 3;
export const INVESTIGATE_COST = 3;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Mean absolute difference over the axes the target specifies (0 = identical, 3 = opposite). */
export function axisDistance(a: Axes, target: Partial<Axes>): number {
  let sum = 0;
  let n = 0;
  for (const k of AXIS_KEYS) {
    const t = target[k];
    if (t === undefined) continue;
    sum += Math.abs(a[k] - t);
    n++;
  }
  return n ? sum / n : 0;
}

export const partyDistance = (a: Axes, b: Axes) => axisDistance(a, b);

/**
 * Popularity effect of introducing a bill. Aligned (distance ≤ 1) yields +5..+15,
 * misaligned yields −5..−15 (voter backlash for a "flip-flop").
 */
export function billDelta(a: Axes, target: Partial<Axes>): number {
  const d = axisDistance(a, target);
  if (d <= 1) return Math.round(15 - 10 * d);
  return -Math.min(15, Math.round(5 + 5 * (d - 1)));
}

/**
 * Popularity a party wins for vetoing a bill, based on how much its supporters oppose it:
 * mild disagreement (distance ~1.25) earns +1, a bill from the opposite camp (distance 3) earns +5.
 */
export function vetoApplause(a: Axes, target: Partial<Axes>): number {
  return Math.max(0, Math.round((axisDistance(a, target) - 1) * 2.5));
}

export type Lean = 'low' | 'high' | 'balanced';
export const lean = (v: number): Lean => (v < 2.5 ? 'low' : v > 2.5 ? 'high' : 'balanced');

export function poleName(k: AxisKey, v: number): string {
  const l = lean(v);
  return l === 'low' ? AXIS_INFO[k].low : l === 'high' ? AXIS_INFO[k].high : L(`Balanced ${AXIS_INFO[k].name}`, `${AXIS_INFO[k].name} Equilibrado`);
}

/** Left→right ideological score. */
export const ideologyScore = (a: Axes) => a.econ * 0.45 + a.social * 0.35 + a.inst * 0.2;

/**
 * Seating order for the chamber, left to right: opposition benches (by ideology),
 * then the government benches with the Prime Minister's party at the far right.
 */
/** The Leader of the Opposition: the largest party outside the government (none until a government exists). */
export function oppositionLeader<T extends { id: number; inGov: boolean; isPM: boolean; seats: number }>(players: T[]): T | undefined {
  if (!players.some((p) => p.isPM)) return undefined;
  return [...players].filter((p) => !p.inGov && p.seats > 0).sort((a, b) => b.seats - a.seats || a.id - b.id)[0];
}

export function benchOrder<T extends { inGov: boolean; isPM: boolean; party: { axes: Axes } }>(players: T[]): T[] {
  const byIdeology = (a: T, b: T) => ideologyScore(a.party.axes) - ideologyScore(b.party.axes);
  const opp = players.filter((p) => !p.inGov).sort(byIdeology);
  const gov = players.filter((p) => p.inGov).sort((a, b) => Number(a.isPM) - Number(b.isPM) || byIdeology(a, b));
  return [...opp, ...gov];
}

/**
 * Approval saturates: gains shrink and losses grow the more popular a party already is.
 * At 30 popularity changes apply roughly at face value; at 80 a +10 is worth +4 and a −10 costs −14.
 */
export function scalePopularity(amt: number, current: number): number {
  if (amt === 0) return 0;
  const f = amt > 0 ? 1.2 - current / 100 : 0.6 + current / 100;
  const v = Math.round(amt * Math.max(0.1, f));
  return v === 0 ? Math.sign(amt) : v;
}


/** Hare quota with largest remainders, so the result always sums to `total`. */
export function allocateSeats(weights: number[], total = TOTAL_SEATS): number[] {
  const w = weights.map((x) => Math.max(0, x));
  const sum = w.reduce((s, x) => s + x, 0) || 1;
  const quotas = w.map((x) => (x / sum) * total);
  const seats = quotas.map(Math.floor);
  let rem = total - seats.reduce((s, x) => s + x, 0);
  const order = quotas.map((q, i) => ({ i, r: q - Math.floor(q) })).sort((a, b) => b.r - a.r);
  for (let j = 0; rem > 0; j++, rem--) seats[order[j % order.length].i]++;
  return seats;
}
