/**
 * The Leader of Congress's official portrait, propaganda-poster style: the leader's bust in a buttoned tunic before a
 * sunburst in the party's colour, the party emblem pinned on the chest, and a title plate below.
 * The canvas is 512×768: the painting fills the top 600 px, the title plate the rest.
 */
import * as THREE from 'three';
import { emblemImage, image } from '../../assets';
import { THEME } from '../../assets/theme';
import type { PartyDef } from '../../core/types';
import { css, drawCover, drawEmblem, fitText, FONT, makeCanvas, mix, toTexture } from './canvas';

/** Height of the painting; the title plate fills the rest of the canvas. */
const PAINTING_H = 600;

/** Canvas + texture for the portrait (redrawn by drawPortrait whenever the Leader of Congress changes). */
export function portraitCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const { canvas } = makeCanvas(512, 768);
  return { canvas, texture: toTexture(canvas) };
}

/** Paints the portrait. `party` null means there is no government yet: an empty, greyed-out frame. */
export function drawPortrait(canvas: HTMLCanvasElement, party: PartyDef | null, title: string, subtitle: string): void {
  const ctx = canvas.getContext('2d')!;
  const color = party?.color ?? 0x59606e;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawSunburst(ctx, canvas.width, color, !!party);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, PAINTING_H);
  ctx.clip();
  const art = image('portrait.leader');
  if (party && art) {
    // Custom bust art (a transparent PNG) over the sunburst, with the party badge in the corner.
    drawCover(ctx, art, 0, 0, canvas.width, PAINTING_H);
    drawBadge(ctx, party, 64, PAINTING_H - 64);
  } else {
    drawBust(ctx, canvas.width, party);
  }
  ctx.restore();

  drawVarnish(ctx, canvas.width);
  drawTitlePlate(ctx, canvas.width, canvas.height, color, title, subtitle);
  ctx.restore();
}

/** Rays in the party colour, a glowing halo behind the head and a dark vignette. */
function drawSunburst(ctx: CanvasRenderingContext2D, W: number, color: number, hasParty: boolean): void {
  const cx = W / 2;
  const cy = 250;
  ctx.fillStyle = mix(color, 0x000000, 0.25);
  ctx.fillRect(0, 0, W, PAINTING_H);
  const rays = 36;
  ctx.fillStyle = mix(color, 0xfff4d6, hasParty ? 0.35 : 0.15);
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 900, cy + Math.sin(a0) * 900);
    ctx.lineTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900);
    ctx.closePath();
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, 260);
  halo.addColorStop(0, 'rgba(255, 245, 210, 0.75)');
  halo.addColorStop(0.5, 'rgba(255, 230, 170, 0.25)');
  halo.addColorStop(1, 'rgba(255, 230, 170, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, PAINTING_H);
  const vignette = ctx.createRadialGradient(
    cx,
    PAINTING_H / 2,
    PAINTING_H * 0.35,
    cx,
    PAINTING_H / 2,
    PAINTING_H * 0.8,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, PAINTING_H);
}

/** The party badge: a gold-rimmed disc in the party colour with its emblem. */
function drawBadge(ctx: CanvasRenderingContext2D, party: PartyDef, x: number, y: number): void {
  ctx.fillStyle = css(THEME.gold);
  ctx.beginPath();
  ctx.arc(x, y, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(party.color);
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  drawEmblem(ctx, party.icon, emblemImage(party.key), x, y + 2, 28);
}

/** The painted leader. Without a party, a dark silhouette with a question mark. */
function drawBust(ctx: CanvasRenderingContext2D, W: number, party: PartyDef | null): void {
  const cx = W / 2;
  const color = party?.color ?? 0x59606e;
  const ghost = !party;
  const skin = ghost ? '#2a2e36' : '#e7bb92';
  const skinShade = ghost ? '#22262d' : '#c99570';
  const suit = ghost ? '#23272e' : mix(0x56606a, color, 0.12);
  const suitDark = ghost ? '#1c1f25' : mix(0x323840, color, 0.1);

  // Shoulders in a buttoned, high-collared tunic.
  const body = ctx.createLinearGradient(40, 0, W - 40, 0);
  body.addColorStop(0, suitDark);
  body.addColorStop(0.45, suit);
  body.addColorStop(1, suitDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(10, PAINTING_H);
  ctx.bezierCurveTo(20, 500, 90, 445, 200, 418);
  ctx.lineTo(312, 418);
  ctx.bezierCurveTo(422, 445, 492, 500, W - 10, PAINTING_H);
  ctx.closePath();
  ctx.fill();

  // Neck.
  const neck = ctx.createLinearGradient(210, 0, 302, 0);
  neck.addColorStop(0, skinShade);
  neck.addColorStop(0.5, skin);
  neck.addColorStop(1, skinShade);
  ctx.fillStyle = neck;
  ctx.fillRect(212, 330, 88, 100);

  if (party) drawTunicDetails(ctx, cx, party, suit, suitDark);

  // Head: swept-back hair, ears, then the face.
  ctx.fillStyle = ghost ? '#1b1e24' : '#221c18';
  ctx.beginPath();
  ctx.ellipse(cx, 232, 98, 124, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = skinShade;
    ctx.beginPath();
    ctx.ellipse(cx + side * 92, 272, 17, 32, side * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  const face = ctx.createRadialGradient(cx - 22, 236, 20, cx, 268, 120);
  face.addColorStop(0, ghost ? '#30343c' : '#f6d2ae');
  face.addColorStop(0.6, skin);
  face.addColorStop(1, skinShade);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, 270, 90, 104, 0, 0, Math.PI * 2);
  ctx.fill();

  if (ghost) {
    // No Leader of Congress yet: a question mark where the face would be.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `900 150px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, 285);
  } else {
    drawFace(ctx, cx);
  }
}

/** Collar, buttons, breast pockets and the party badge. */
function drawTunicDetails(
  ctx: CanvasRenderingContext2D,
  cx: number,
  party: PartyDef,
  suit: string,
  suitDark: string,
): void {
  // Turn-down collar.
  ctx.fillStyle = suit;
  ctx.strokeStyle = suitDark;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 50, 404);
    ctx.lineTo(cx + side * 70, 452);
    ctx.lineTo(cx + side * 4, 470);
    ctx.lineTo(cx + side * 4, 430);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Placket and buttons.
  ctx.strokeStyle = suitDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, 470);
  ctx.lineTo(cx, PAINTING_H);
  ctx.stroke();
  ctx.fillStyle = mix(0x2a2f36, 0xffffff, 0.15);
  for (const y of [492, 540, 588]) {
    ctx.beginPath();
    ctx.arc(cx + 9, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Breast pockets with flaps.
  ctx.strokeStyle = suitDark;
  ctx.lineWidth = 3;
  for (const x of [130, 312]) {
    ctx.strokeRect(x, 520, 70, 70);
    ctx.beginPath();
    ctx.moveTo(x - 4, 520);
    ctx.lineTo(x + 74, 520);
    ctx.lineTo(x + 70, 546);
    ctx.lineTo(x, 546);
    ctx.closePath();
    ctx.stroke();
  }
  drawBadge(ctx, party, 166, 488);
}

/** Hairline, eyebrows, eyes, nose, a faint smile and rosy cheeks. */
function drawFace(ctx: CanvasRenderingContext2D, cx: number): void {
  // Hairline: a high, rounded forehead.
  ctx.fillStyle = '#221c18';
  ctx.beginPath();
  ctx.moveTo(cx - 92, 238);
  ctx.bezierCurveTo(cx - 88, 176, cx - 40, 160, cx, 168);
  ctx.bezierCurveTo(cx + 40, 160, cx + 88, 176, cx + 92, 238);
  ctx.lineTo(cx + 100, 150);
  ctx.lineTo(cx - 100, 150);
  ctx.closePath();
  ctx.fill();

  // Eyebrows.
  ctx.strokeStyle = '#2b211b';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 16, 236);
    ctx.quadraticCurveTo(cx + side * 36, 226, cx + side * 58, 234);
    ctx.stroke();
  }
  // Calm, slightly narrowed eyes.
  for (const side of [-1, 1]) {
    const ex = cx + side * 36;
    ctx.fillStyle = '#fbf3ea';
    ctx.beginPath();
    ctx.moveTo(ex - 15, 258);
    ctx.quadraticCurveTo(ex, 249, ex + 15, 258);
    ctx.quadraticCurveTo(ex, 264, ex - 15, 258);
    ctx.fill();
    ctx.fillStyle = '#2a1d15';
    ctx.beginPath();
    ctx.arc(ex, 257, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 50, 35, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - 16, 257);
    ctx.quadraticCurveTo(ex, 247, ex + 16, 257);
    ctx.stroke();
  }
  // Nose.
  ctx.strokeStyle = 'rgba(150, 95, 65, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 6, 262);
  ctx.quadraticCurveTo(cx - 10, 290, cx - 14, 302);
  ctx.quadraticCurveTo(cx, 310, cx + 14, 302);
  ctx.stroke();
  // A faint, confident smile.
  ctx.strokeStyle = '#a65a4a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 26, 330);
  ctx.quadraticCurveTo(cx, 342, cx + 26, 330);
  ctx.stroke();
  // Rosy cheeks, poster style.
  for (const side of [-1, 1]) {
    const blush = ctx.createRadialGradient(cx + side * 52, 300, 2, cx + side * 52, 300, 26);
    blush.addColorStop(0, 'rgba(230, 120, 100, 0.35)');
    blush.addColorStop(1, 'rgba(230, 120, 100, 0)');
    ctx.fillStyle = blush;
    ctx.fillRect(cx + side * 52 - 30, 270, 60, 60);
  }
}

/** Varnish sheen and an inner gilt border over the painting. */
function drawVarnish(ctx: CanvasRenderingContext2D, W: number): void {
  const sheen = ctx.createLinearGradient(0, 0, W, PAINTING_H);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, PAINTING_H);
  ctx.strokeStyle = css(THEME.gold);
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, PAINTING_H - 28);
}

/** "LEADER OF CONGRESS" and the party name on a plate in the party colour. */
function drawTitlePlate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  color: number,
  title: string,
  subtitle: string,
): void {
  const plate = ctx.createLinearGradient(0, PAINTING_H, 0, H);
  plate.addColorStop(0, mix(color, 0x000000, 0.35));
  plate.addColorStop(1, mix(color, 0x000000, 0.6));
  ctx.fillStyle = plate;
  ctx.fillRect(0, PAINTING_H, W, H - PAINTING_H);
  ctx.fillStyle = css(THEME.gold);
  ctx.fillRect(0, PAINTING_H, W, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  // Text stays clear of the frame's inner border.
  const maxWidth = W - 90;
  ctx.fillStyle = '#ffd76a';
  const oneLine = fittingSize(ctx, [title], maxWidth, 56);
  if (oneLine >= TITLE_MIN || !title.includes(' ')) {
    ctx.font = `900 ${oneLine}px ${FONT}`;
    ctx.fillText(title, W / 2, PAINTING_H + 76);
    ctx.fillStyle = '#fff4dc';
    fitText(ctx, subtitle, W / 2, PAINTING_H + 132, maxWidth, 32, 700);
    return;
  }
  // A long title ("LEADER OF CONGRESS") goes on two big lines rather than one small one.
  const lines = splitInTwo(ctx, title);
  const px = fittingSize(ctx, lines, maxWidth, 52);
  ctx.font = `900 ${px}px ${FONT}`;
  ctx.fillText(lines[0], W / 2, PAINTING_H + 54);
  ctx.fillText(lines[1], W / 2, PAINTING_H + 54 + px * 0.98);
  ctx.fillStyle = '#fff4dc';
  fitText(ctx, subtitle, W / 2, PAINTING_H + 152, maxWidth, 28, 700);
}

/** Smallest font size a one-line title may shrink to before it is split over two lines. */
const TITLE_MIN = 46;

/** The largest font size, up to `size`, at which every line fits in `maxWidth`. */
function fittingSize(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number, size: number): number {
  let px = size;
  for (; px > 16; px--) {
    ctx.font = `900 ${px}px ${FONT}`;
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) break;
  }
  return px;
}

/** Splits a title at the space that makes its two lines the most even. */
function splitInTwo(ctx: CanvasRenderingContext2D, title: string): [string, string] {
  const words = title.split(' ');
  ctx.font = `900 52px ${FONT}`;
  let best: [string, string] = [title, ''];
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines: [string, string] = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (width < bestWidth) {
      bestWidth = width;
      best = lines;
    }
  }
  return best;
}
