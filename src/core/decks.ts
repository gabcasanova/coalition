import { BILLS } from '../data/bills';
import { STRATEGY_CARDS } from '../data/strategyCards';
import { isPT } from '../i18n';
import { CARDS_PT } from '../i18n/pt-BR';
import { shuffle } from './rules';
import type { Card, CardDef } from './types';

/** Card text in the current language. */
const localize = (d: CardDef): CardDef =>
  isPT && CARDS_PT[d.key] ? { ...d, name: CARDS_PT[d.key][0], text: CARDS_PT[d.key][1] } : d;

/** The two shuffled player decks: LAW (policy bills) and STRATEGY (everything else). */
export function buildDecks(): { laws: Card[]; strategy: Card[] } {
  let uid = 1;
  const laws: Card[] = BILLS.map((d) => ({ ...localize(d), uid: uid++ }));
  const strategy: Card[] = [];
  for (const [def, copies] of STRATEGY_CARDS) {
    for (let i = 0; i < copies; i++) strategy.push({ ...localize(def), uid: uid++ });
  }
  return { laws: shuffle(laws), strategy: shuffle(strategy) };
}

/** A face-up event deck (crises, media, lobbies) that reshuffles its discards when it runs out. */
export class Pile<T> {
  private cards: T[];
  private used: T[] = [];

  constructor(items: readonly T[]) {
    this.cards = shuffle([...items]);
  }

  next(): T {
    if (!this.cards.length) {
      this.cards = shuffle(this.used);
      this.used = [];
    }
    const c = this.cards.pop()!;
    this.used.push(c);
    return c;
  }
}
