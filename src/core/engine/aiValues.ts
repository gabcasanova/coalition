/** How the AI values resources, in popularity points (used to score the options it is offered). */
import { type Portfolio } from '../types';

// AI valuation weights: how much a unit of each resource is worth in popularity points.
// ⭐ Political Capital is worth about this many popularity points to the AI.
export const W_CAP = 0.8;
export const W_CARD = 2.5;
export const PF_VALUE: Record<Portfolio, number> = { economy: 1.2, information: 1, environment: 0.8, interior: 1.1 };
