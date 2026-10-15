/** Small labels: the emblem tag floating above every pawn and the name plates on the leaders' lecterns. */
import * as THREE from 'three';
import { emblemImage } from '../../assets';
import { THEME } from '../../assets/theme';
import { css, drawEmblem, fitText, makeCanvas, toTexture } from './canvas';

/**
 * Tag floating above a pawn, 256×240 px: a big party emblem in a disc, with a name pill underneath.
 * Pass `emblem` (the party's icon and key) to draw the disc; without it only the pill is drawn.
 */
export function labelTexture(
  text: string,
  color: number,
  emblem?: { icon: string; key?: string },
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 240);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (emblem) {
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.arc(128, 80, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(128, 80, 58, 0, Math.PI * 2);
    ctx.fill();
    drawEmblem(ctx, emblem.icon, emblemImage(emblem.key), 128, 86, 86);
  }
  // Name pill
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.roundRect(28, 168, 200, 64, 32);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  fitText(ctx, text, 128, 202, 180, 44, 900);
  return toTexture(canvas);
}

/** A brass-edged wooden name plate for a lectern, 512×216 px. `accent` is the colour of the stripe under the text. */
export function nameplateTexture(text: string, accent: string): THREE.CanvasTexture {
  const W = 512;
  const H = 216;
  const { canvas, ctx } = makeCanvas(W, H);
  const wood = ctx.createLinearGradient(0, 0, 0, H);
  wood.addColorStop(0, '#3b2414');
  wood.addColorStop(1, '#22140b');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = css(THEME.gold);
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = accent;
  ctx.fillRect(24, H - 46, W - 48, 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe7a3';
  // Long titles ("LEADER OF THE OPPOSITION") go on two lines.
  const words = text.split(' ');
  if (words.length > 2) {
    const mid = Math.ceil(words.length / 2);
    fitText(ctx, words.slice(0, mid).join(' '), W / 2, 62, W - 60, 56);
    fitText(ctx, words.slice(mid).join(' '), W / 2, 126, W - 60, 56);
  } else fitText(ctx, text, W / 2, 96, W - 60, 72);
  return toTexture(canvas);
}
