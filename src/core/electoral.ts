/**
 * The electoral system: 24 multi-member districts, seats shared out in each district by the D'Hondt method.
 *
 * A party's vote in a district = its national popularity × how well it fits the district's political character
 * × a little local chance. So popularity still decides most of the result, but geography distorts it the way real
 * parliaments do: strongholds pay off, small parties spread thinly across the country lose out, big parties pick
 * up a seat bonus (D'Hondt rounds in their favour, most of all in small districts) and rural votes weigh more.
 */
import { DISTRICTS } from '../data/districts';
import { partyDistance } from './rules';
import type { Axes } from './types';

/** How much a district's character pulls its vote: 0 = every district votes like the nation. */
const REGIONAL_PULL = 1.0;
/** Random local swing in each district, ± this fraction. */
const LOCAL_SWING = 0.15;
/** Voters per seat in rural districts compared with the rest (below 1 = rural votes weigh more). */
const RURAL_VOTERS_PER_SEAT = 0.8;
/** Voters per seat elsewhere (only the ratio matters). */
const VOTERS_PER_SEAT = 10_000;

export interface DistrictResult {
  key: string;
  name: string;
  seats: number;
  /** Votes per player (indexed like the players array). */
  votes: number[];
  /** Seats won per player. */
  seatsWon: number[];
  /** The player with the most seats here (ties go to the most votes). */
  winnerId: number;
}

export interface NationalResult {
  /** Seats per player. */
  seats: number[];
  /** National vote share per player, in percent. */
  voteShare: number[];
  districts: DistrictResult[];
}

/**
 * D'Hondt: hand out `seats` one at a time, each to the party with the highest votes ÷ (seats won so far + 1).
 * Ties go to the party with more votes.
 */
export function dHondt(votes: number[], seats: number): number[] {
  const won = votes.map(() => 0);
  for (let s = 0; s < seats; s++) {
    let best = 0;
    for (let i = 1; i < votes.length; i++) {
      const q = votes[i] / (won[i] + 1);
      const qBest = votes[best] / (won[best] + 1);
      if (q > qBest || (q === qBest && votes[i] > votes[best])) best = i;
    }
    won[best]++;
  }
  return won;
}

/** Runs a general election for parties with the given ideology and national popularity. */
export function runElection(parties: { axes: Axes; popularity: number }[]): NationalResult {
  const seats = parties.map(() => 0);
  const totalVotes = parties.map(() => 0);

  const districts = DISTRICTS.map((d) => {
    const voters = d.seats * VOTERS_PER_SEAT * (d.rural ? RURAL_VOTERS_PER_SEAT : 1);
    // Each party's support here: national popularity, scaled by how well it fits the district, plus local chance.
    const support = parties.map((p) => {
      const fit = Math.exp(-REGIONAL_PULL * partyDistance(p.axes, d.lean));
      const swing = 1 + (Math.random() * 2 - 1) * LOCAL_SWING;
      return Math.max(p.popularity, 0.01) * fit * swing;
    });
    const sum = support.reduce((a, b) => a + b, 0);
    const votes = support.map((s) => Math.round((s / sum) * voters));
    const seatsWon = dHondt(votes, d.seats);
    seatsWon.forEach((n, i) => (seats[i] += n));
    votes.forEach((v, i) => (totalVotes[i] += v));
    const winnerId = votes.map((v, i) => ({ i, v, s: seatsWon[i] })).sort((a, b) => b.s - a.s || b.v - a.v)[0].i;
    return { key: d.key, name: d.name, seats: d.seats, votes, seatsWon, winnerId };
  });

  const allVotes = totalVotes.reduce((a, b) => a + b, 0) || 1;
  return { seats, voteShare: totalVotes.map((v) => (v / allVotes) * 100), districts };
}
