import * as THREE from 'three';
import { BOARD, isAnchor } from '../core/board';
import { BOARD_SIZE } from '../core/rules';

/**
 * Sizes and positions of everything on the table, in world units (the table is about 64 units across).
 *
 * Two kinds of angle are used:
 * - Track angle (`squareAngle`): 0 is the far side of the table (behind parliament), growing clockwise.
 *   Square 0, the Election, sits at angle 0.
 * - Chamber angle (`polar`): 0 points right (the government end of the hemicycle), π points left (the
 *   opposition end), and π/2 is the back of the chamber.
 */

// ───────────── track ─────────────

/** Width of the gap between the Election square and the Cabinet square where the escalator runs, in squares. */
export const ESCALATOR_GAP = 2;
/** Angle between neighbouring squares. */
export const PITCH = (Math.PI * 2) / (BOARD_SIZE + ESCALATOR_GAP);
/** Radius of the ring of squares (enlarged so the squares keep their size despite the escalator gap). */
export const RING_R = (22 * (BOARD_SIZE + ESCALATOR_GAP)) / BOARD_SIZE;
/** Square size: width along the ring and depth across it. */
export const TILE_DEPTH = 4;
export const TILE_W = RING_R * PITCH * 0.94;

/** Track angle of square i. */
export const squareAngle = (i: number) => (i === 0 ? 0 : (i + ESCALATOR_GAP) * PITCH);

/** World point on the track at radius `r` and track angle `a`. */
export const trackPoint = (r: number, a: number, y = 0) => new THREE.Vector3(r * Math.sin(a), y, -r * Math.cos(a));

/**
 * Squares climb like a spiral staircase: square 1 (just after the election) is the lowest,
 * and the Parliamentary Election (square 0) crowns the year at the top.
 */
export const tileHeight = (i: number) =>
  0.35 + ((i - 1 + BOARD_SIZE) % BOARD_SIZE) * 0.075 + (isAnchor(BOARD[i]) ? 0.2 : 0);

// ───────────── centre of the table ─────────────

export const WHEEL_R = 6;

// ───────────── parliament ─────────────

/** Radius and height of the 7 tiered bench rows. */
export const ROW_RADII = Array.from({ length: 7 }, (_, i) => 8.3 + i * 1.3);
export const ROW_HEIGHTS = ROW_RADII.map((_, i) => 0.25 + i * 0.26);
/** Angle of the aisle (red carpet) between the government and opposition blocks. */
export const AISLE_GAP = 0.32;
/** Angle left free at each end of the hemicycle for the Prime Minister's and the Opposition Leader's daises. */
export const END_GAP = 0.28;
/** Leader figures are big peg people. */
export const LEADER_SCALE = 2.2;
/** Where the overall-standings podium stands: beside the opposition benches, facing the camera side. */
export const PODIUM_POS = new THREE.Vector3(-12.8, 0, 2.7);

/** World point in the chamber at radius `r` and chamber angle `phi`. */
export const polar = (r: number, phi: number, y = 0) => new THREE.Vector3(r * Math.cos(phi), y, -r * Math.sin(phi));
