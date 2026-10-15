/** The LED scoreboards for the government and the opposition, behind the benches. */
import * as THREE from 'three';
import { L } from '../../i18n';
import { css, fitText, FONT, makeCanvas, toTexture } from './canvas';

export interface PlaqueRow {
  label: string;
  seats: number;
  color: number;
}

/** A 1024×480 canvas + texture for one scoreboard (redrawn by drawLedPlaque). */
export function plaqueCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const { canvas } = makeCanvas(1024, 480);
  return { canvas, texture: toTexture(canvas) };
}

/** Redraws a scoreboard in big glowing type: title, subtitle, total seats and one row per party. */
export function drawLedPlaque(
  canvas: HTMLCanvasElement,
  title: string,
  subtitle: string,
  seats: number,
  accent: string,
  rows: PlaqueRow[],
): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#040507';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.shadowBlur = 24;

  // Big seat count on the right.
  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.font = `900 220px ${FONT}`;
  const seatsText = String(seats);
  const seatsWidth = ctx.measureText(seatsText).width;
  ctx.fillText(seatsText, W - 28, 196);

  // Title and subtitle on the left.
  ctx.textAlign = 'left';
  const left = W - seatsWidth - 80;
  fitText(ctx, title, 30, 104, left, 104);
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = '#ffd76a';
  fitText(ctx, subtitle, 30, 170, left, 44, 800);

  // Party rows (largest first); a fourth party or more collapses into "+N more".
  const shown = rows.length > 3 ? rows.slice(0, 2) : rows;
  shown.forEach((row, i) => {
    const y = 290 + i * 76;
    ctx.shadowColor = css(row.color);
    ctx.fillStyle = css(row.color);
    ctx.fillRect(30, y - 46, 46, 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText(String(row.seats), W - 30, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f4f8';
    fitText(ctx, row.label, 96, y, W - 260, 58, 800);
  });
  if (rows.length > 3) {
    const rest = rows.slice(2);
    const restSeats = rest.reduce((n, r) => n + r.seats, 0);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9d1de';
    ctx.shadowColor = '#c9d1de';
    fitText(
      ctx,
      L(
        `+ ${rest.length} more parties (${restSeats} seats)`,
        `+ ${rest.length} outros partidos (${restSeats} cadeiras)`,
      ),
      30,
      290 + 2 * 76,
      W - 60,
      52,
      800,
    );
  }
  if (!rows.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7d8798';
    ctx.shadowBlur = 0;
    fitText(ctx, L('awaiting formation…', 'aguardando formação…'), 30, 300, W - 60, 56, 800);
  }

  // LED pixel grid
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 2, H);
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
}
