/**
 * The map of the country's electoral districts, drawn on a canvas. The coastline and borders are generated from
 * the district positions in data/districts.ts: each district is the land closest to its centre, with a little
 * noise so borders and coasts wiggle like real ones. The shape never changes, so it is computed only once.
 */
import { DISTRICTS } from '../../data/districts';

/** Map coordinates (x 0..1.4, y 0..1) to canvas pixels. */
const SCALE = 300;
const MARGIN = 18;
const W = Math.round(1.4 * SCALE + 2 * MARGIN);
const H = Math.round(1 * SCALE + 2 * MARGIN);

const WATER = 0x0b1a2e;
const UNCOUNTED = 0x3a4252;

/** Islands are drawn as their own small landmasses; everything else merges into the mainland. */
const isIsland = (key: string) => key.includes('isles');
/** How far a mainland district's land spreads from its centre (bigger districts spread further). */
const spread = (seats: number) => 0.15 + 0.003 * seats;
const ISLAND_RADIUS = 0.055;

// ───────────── smooth noise (for wobbly coasts and borders) ─────────────

function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy; // 0..1
}

/** Noise in −1..1 at map position (x, y), with detail at a few scales. */
const noise = (x: number, y: number) =>
  (valueNoise(x * 6, y * 6) * 0.6 + valueNoise(x * 14 + 7, y * 14 + 3) * 0.3 + valueNoise(x * 30, y * 30) * 0.1) * 2 -
  1;

// ───────────── which district owns each pixel (computed once) ─────────────

/** Per pixel: the index of its district, or −1 for water. */
let owners: Int16Array | null = null;

function computeOwners(): Int16Array {
  const out = new Int16Array(W * H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px - MARGIN) / SCALE;
      const y = (py - MARGIN) / SCALE;
      // Warp the position a little so borders aren't straight lines.
      const wx = x + noise(x, y) * 0.035;
      const wy = y + noise(x + 5.2, y + 1.3) * 0.035;
      // The mainland: a smooth field that adds up every district's spread, so neighbours merge into one country
      // with a ragged coast. Each land pixel belongs to the nearest district (bigger districts reach a bit further).
      let field = 0;
      let best = -1;
      let bestScore = Infinity;
      let island = -1;
      DISTRICTS.forEach((d, i) => {
        const dist = Math.hypot(wx - d.x, wy - d.y);
        if (isIsland(d.key)) {
          if (dist < ISLAND_RADIUS * (1 + noise(x * 3, y * 3) * 0.3)) island = i;
          return;
        }
        const r = spread(d.seats);
        field += Math.exp(-((dist / r) ** 2));
        const score = dist - r * 0.4;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      const mainland = field + noise(x * 1.7, y * 1.7) * 0.3 > 0.95;
      out[py * W + px] = island >= 0 ? island : mainland ? best : -1;
    }
  }
  return out;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export class DistrictMap {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'tvmap';
    this.ctx = this.canvas.getContext('2d')!;
    owners ??= computeOwners();
  }

  /** The district under a mouse position (client coordinates), or −1. */
  districtAt(clientX: number, clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const px = Math.floor(((clientX - rect.left) / rect.width) * W);
    const py = Math.floor(((clientY - rect.top) / rect.height) * H);
    if (px < 0 || py < 0 || px >= W || py >= H) return -1;
    return owners![py * W + px];
  }

  /**
   * Paints the map. `fills` gives each district's colour (null = not counted yet). `highlight` brightens one
   * district; `labels` writes each counted district's seat count on it.
   */
  draw(fills: (number | null)[], highlight = -1, labels: (string | null)[] = []): void {
    const image = this.ctx.createImageData(W, H);
    const data = image.data;
    const own = owners!;
    const colours = fills.map((c) => rgb(c ?? UNCOUNTED));
    const water = rgb(WATER);
    for (let p = 0; p < own.length; p++) {
      const o = own[p];
      const px = p % W;
      let [r, g, b] = o < 0 ? water : colours[o];
      if (o >= 0) {
        // Borders: darken pixels next to another district; coasts: lighten pixels next to water.
        const right = px + 1 < W ? own[p + 1] : o;
        const below = p + W < own.length ? own[p + W] : o;
        if ((right >= 0 && right !== o) || (below >= 0 && below !== o)) [r, g, b] = [r * 0.45, g * 0.45, b * 0.45];
        else if (right < 0 || below < 0) [r, g, b] = [r * 0.6 + 90, g * 0.6 + 100, b * 0.6 + 110];
        else if (o === highlight) [r, g, b] = [r * 0.7 + 76, g * 0.7 + 76, b * 0.7 + 76];
        // A faint texture on uncounted land.
        if (fills[o] === null && ((px + Math.floor(p / W)) & 7) === 0) [r, g, b] = [r + 12, g + 12, b + 12];
      }
      const i = p * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
    this.ctx.putImageData(image, 0, 0);

    // Seat counts on counted districts.
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
    DISTRICTS.forEach((d, i) => {
      const label = labels[i];
      if (!label) return;
      const x = MARGIN + d.x * SCALE;
      const y = MARGIN + d.y * SCALE;
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      this.ctx.strokeText(label, x, y);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText(label, x, y);
    });
  }
}
