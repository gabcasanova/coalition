import { ANCHORS, SQUARE_QUOTAS } from '../data/squares';
import { BOARD_SIZE } from './rules';
import type { SquareType } from './types';

/** The board: the anchor squares plus the regular squares spread as evenly as possible around the ring. */
export const BOARD: SquareType[] = buildBoard();

function buildBoard(): SquareType[] {
  const total = SQUARE_QUOTAS.reduce((s, [, q]) => s + q, 0);
  const placed = new Map<SquareType, number>(SQUARE_QUOTAS.map(([t]) => [t, 0]));
  const out: SquareType[] = [];
  let slot = 0;
  let prev: SquareType | null = null;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const anchor = ANCHORS[i];
    if (anchor) {
      out.push(anchor);
      prev = anchor;
      continue;
    }
    slot++;
    // Pick the square type that is furthest behind its fair share, avoiding two of a kind in a row.
    let best: SquareType = 'legislature';
    let bestNeed = -Infinity;
    for (const [t, q] of SQUARE_QUOTAS) {
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

/** The four fixed squares (they are drawn a little taller, with a gold border). */
export const isAnchor = (t: SquareType) =>
  t === 'election' || t === 'formation' || t === 'midterm' || t === 'presidential' || t === 'debate';
