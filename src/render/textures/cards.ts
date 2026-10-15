/** Textures for things that pop up during play: drawn cards, vote headlines and floating popularity numbers. */
import * as THREE from 'three';
import type { CardFace } from '../../core/types';
import { css, fitText, FONT, makeCanvas, toTexture, wrapText } from './canvas';

/** Face of a drawn card, 480×672 px, as shown to everyone during the draw animation. */
export function cardFaceTexture(face: CardFace, color: number): THREE.CanvasTexture {
  const W = 480;
  const H = 672;
  const { canvas, ctx } = makeCanvas(W, H);
  const base = new THREE.Color(color);
  ctx.fillStyle = '#' + base.clone().lerp(new THREE.Color(0x000000), 0.25).getHexString();
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.roundRect(18, 18, W - 36, H - 36, 18);
  ctx.fill();

  // Header band with the deck label
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.roundRect(18, 18, W - 36, 74, [18, 18, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, face.label, W / 2, 56, W - 80, 30, 900);

  // Title
  ctx.fillStyle = '#14161c';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 44px ${FONT}`;
  const titleLines = wrapText(ctx, face.title, W - 76).slice(0, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, 152 + i * 50));
  let y = 152 + titleLines.length * 50 - 10;
  ctx.fillStyle = css(color);
  ctx.fillRect(60, y, W - 120, 5);
  y += 44;

  // Flavour text
  ctx.fillStyle = '#4a4f5c';
  ctx.font = `italic 500 25px ${FONT}`;
  for (const line of wrapText(ctx, face.flavor, W - 80).slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 32;
  }
  y += 12;

  // What the card does: a paragraph, shrunk until it fits the space left on the card.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#14161c';
  let size = 26;
  let lines: string[];
  do {
    ctx.font = `600 ${size}px ${FONT}`;
    lines = wrapText(ctx, face.text, W - 80);
  } while (y + lines.length * size * 1.3 > H - 36 && --size > 14);
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += size * 1.3;
  }
  return toTexture(canvas);
}

/** Big glowing headline floating over the chamber ("✔ BILL PASSED", "OPPOSITION FORMED"). */
export function headlineTexture(text: string, color: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(1024, 216);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,11,18,0.82)';
  ctx.beginPath();
  ctx.roundRect(12, 20, 1000, 176, 40);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = css(color);
  ctx.stroke();
  ctx.shadowColor = css(color);
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  fitText(ctx, text, 512, 112, 940, 120, 900);
  return toTexture(canvas);
}

/** A popularity change ("+5", "−3") floating up from a pawn. */
export function floatTexture(text: string, color: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 96);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 76px ${FONT}`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, 128, 50);
  ctx.fillStyle = css(color);
  ctx.fillText(text, 128, 50);
  return toTexture(canvas);
}
