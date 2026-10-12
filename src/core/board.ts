import { isPT } from './i18n';
import { SQUARES_PT } from './locale_pt';
import type { SquareType } from './types';

export interface SquareMeta {
  name: string;
  /** Big one-word label printed on the board square. */
  short: string;
  icon: string;
  color: number;
  desc: string;
}

export const SQUARE_META: Record<SquareType, SquareMeta> = {
  election: {
    name: 'Parliamentary Election',
    short: 'ELECTION',
    icon: '🗳️',
    color: 0xd9a514,
    desc: 'The year ends here. Every party stops on this square and waits; when the last party arrives, the nation votes and popularity converts into the 150 seats of parliament.',
  },
  formation: {
    name: 'Government Formation',
    short: 'CABINET',
    icon: '🤝',
    color: 0xd9692a,
    desc: 'Cabinet briefing. Governing parties gain +2 ⭐ capital; opposition parties draw a card.',
  },
  midterm: {
    name: 'Midterm Convention',
    short: 'MIDTERM',
    icon: '🎪',
    color: 0x14967d,
    desc: 'The first party to reach this square each year reveals a Global Crisis that hits every party. Landing here exactly: party convention, +4 popularity and +2 ⭐.',
  },
  debate: {
    name: 'National Debate',
    short: 'DEBATE',
    icon: '🎙️',
    color: 0x8e44ad,
    desc: 'Challenge a rival to a televised debate on one axis. The party closer to the Public Mood wins +6 popularity; the loser drops 3.',
  },
  legislature: {
    name: 'Legislature Pass',
    short: 'LAW',
    icon: '🏛️',
    color: 0x5b43c4,
    desc: 'Mandatory: introduce a Policy Bill from your hand. Aligned bills win +5 to +15 popularity; misaligned bills cost 5 to 15. Parliament then votes.',
  },
  media: {
    name: 'Media & Campaigns',
    short: 'MEDIA',
    icon: '📺',
    color: 0x1a7fd0,
    desc: 'Hold a press conference (draw 2 cards, keep 1) or turn it into a campaign rally (paid in ⭐ capital, for popularity).',
  },
  crisis: {
    name: 'National Crisis',
    short: 'CRISIS',
    icon: '⚠️',
    color: 0xc0302b,
    desc: 'Draw a local crisis event. Ideology, reaction cards and ⭐ capital can soften the blow.',
  },
  lobby: {
    name: 'Lobbyists & Factions',
    short: 'LOBBY',
    icon: '💼',
    color: 0x239a55,
    desc: 'An interest group offers backing. Aligned parties gain ⭐ capital; others must refuse or risk a voter backlash.',
  },
  committee: {
    name: 'Parliamentary Committee',
    short: 'INQUIRY',
    icon: '🔍',
    color: 0xb8890f,
    desc: 'Draft a report (+2 ⭐), leak a scandal card against a rival, launch an investigation (3 ⭐) or, in opposition, call a vote of no confidence.',
  },
};

if (isPT) for (const [k, t] of Object.entries(SQUARES_PT)) Object.assign(SQUARE_META[k as SquareType], t);

export const ANCHORS: Record<number, SquareType> = {
  0: 'election',
  1: 'formation',
  25: 'midterm',
  37: 'debate',
};

/** 50 squares: 4 anchors plus 46 regular squares spread as evenly as possible. */
export const BOARD: SquareType[] = buildBoard();

function buildBoard(): SquareType[] {
  const quotas: [SquareType, number][] = [
    ['legislature', 18],
    ['media', 9],
    ['crisis', 6],
    ['lobby', 7],
    ['committee', 6],
  ];
  const total = quotas.reduce((s, [, q]) => s + q, 0);
  const placed = new Map<SquareType, number>(quotas.map(([t]) => [t, 0]));
  const out: SquareType[] = [];
  let slot = 0;
  let prev: SquareType | null = null;

  for (let i = 0; i < 50; i++) {
    const anchor = ANCHORS[i];
    if (anchor) {
      out.push(anchor);
      prev = anchor;
      continue;
    }
    slot++;
    let best: SquareType = 'legislature';
    let bestNeed = -Infinity;
    for (const [t, q] of quotas) {
      const n = placed.get(t)!;
      if (n >= q) continue;
      const need = (q * slot) / total - n - (t === prev ? 0.75 : 0);
      if (need > bestNeed) {
        bestNeed = need;
        best = t;
      }
    }
    placed.set(best, placed.get(best)! + 1);
    out.push(best);
    prev = best;
  }
  return out;
}

export const isAnchor = (t: SquareType) => t === 'election' || t === 'formation' || t === 'midterm' || t === 'debate';
