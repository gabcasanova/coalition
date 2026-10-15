/** STRATEGY deck: scandals, rallies, whips, reactions and the vote of no confidence, with their copy counts. */
import type { CardDef } from '../core/types';
import { isPT } from '../i18n';
import { KIND_PT } from '../i18n/pt-BR';

/** [card, number of copies in the deck]. */
export const STRATEGY_CARDS: [CardDef, number][] = [
  // Scandals & mudslinging — played against rivals on Committee squares
  [
    {
      key: 'audit',
      kind: 'scandal',
      name: 'Campaign Audit',
      power: 8,
      tags: ['scandal', 'corruption'],
      text: 'Auditors dig into a rival’s campaign accounts.',
    },
    2,
  ],
  [
    {
      key: 'leak',
      kind: 'scandal',
      name: 'Press Leak',
      power: 6,
      tags: ['scandal', 'media'],
      text: 'Embarrassing internal emails find their way to the press.',
    },
    2,
  ],
  [
    {
      key: 'conflict',
      kind: 'scandal',
      name: 'Conflict of Interest',
      power: 10,
      tags: ['scandal', 'corruption'],
      text: 'A rival leader’s family firm won a state contract.',
    },
    2,
  ],
  [
    {
      key: 'expenses',
      kind: 'scandal',
      name: 'Expense Fraud Exposé',
      power: 12,
      tags: ['scandal', 'corruption'],
      text: 'Taxpayer-funded yachts. The tabloids are thrilled.',
    },
    2,
  ],
  [
    {
      key: 'tweets',
      kind: 'scandal',
      name: 'Old Posts Resurface',
      power: 5,
      tags: ['scandal', 'media'],
      text: 'A decade of unfortunate opinions, screenshotted.',
    },
    2,
  ],
  [
    {
      key: 'recording',
      kind: 'scandal',
      name: 'Secret Recording',
      power: 9,
      tags: ['scandal', 'media'],
      text: '“Off the record” turns out to be on the record.',
    },
    2,
  ],
  // Populist rallies — flat gain regardless of ideology, paid in ⭐ Political Capital
  [
    {
      key: 'grassroots',
      kind: 'rally',
      name: 'Grassroots Speech',
      power: 5,
      cost: 2,
      text: 'A fiery town-square speech. +5 popularity.',
    },
    4,
  ],
  [
    {
      key: 'blitz',
      kind: 'rally',
      name: 'Media Blitz',
      power: 5,
      cost: 3,
      text: 'Saturate the airwaves. +5 popularity and draw a card.',
    },
    3,
  ],
  [
    {
      key: 'stadium',
      kind: 'rally',
      name: 'Stadium Rally',
      power: 8,
      cost: 5,
      text: 'Fill the national stadium. +8 popularity.',
    },
    2,
  ],
  // Whip votes — force a rival to vote with you on a Legislature square
  [
    {
      key: 'discipline',
      kind: 'whip',
      name: 'Party Discipline',
      text: 'Force the largest opposing party to vote YES on your bill.',
    },
    3,
  ],
  [
    {
      key: 'backroom',
      kind: 'whip',
      name: 'Backroom Bargain',
      text: 'A quiet deal: a rival party votes YES on your bill.',
    },
    2,
  ],
  // Reaction / defense — held in hand, used when you are hit
  [
    {
      key: 'spin',
      kind: 'reaction',
      reaction: 'spin',
      name: 'Spin Doctor',
      text: 'Cancel a scandal or media attack entirely.',
    },
    3,
  ],
  [
    {
      key: 'gag',
      kind: 'reaction',
      reaction: 'gag',
      name: 'Gag Order',
      text: 'Cancel a scandal or corruption story entirely.',
    },
    2,
  ],
  [
    {
      key: 'bailout',
      kind: 'reaction',
      reaction: 'bailout',
      name: 'Emergency Bailout',
      text: 'Pay ⭐ capital instead of losing popularity (1 capital per 2 points).',
    },
    3,
  ],
  [
    { key: 'damage', kind: 'reaction', reaction: 'damage', name: 'Damage Control', text: 'Halve any popularity loss.' },
    3,
  ],
  // Opposition only
  [
    {
      key: 'noconf',
      kind: 'noconfidence',
      name: 'Vote of No Confidence',
      text: 'Opposition only, on a Committee square: if the opposition holds 76+ seats, the government falls.',
    },
    3,
  ],
];

/** Card-type names shown on cards. */
export const KIND_LABEL: Record<CardDef['kind'], string> = isPT
  ? KIND_PT
  : {
      bill: 'Policy Bill',
      scandal: 'Scandal',
      rally: 'Populist Rally',
      whip: 'Whip Vote',
      reaction: 'Reaction',
      noconfidence: 'Opposition',
    };
