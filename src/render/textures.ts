import * as THREE from 'three';
import { isAnchor, SQUARE_META } from '../core/board';
import type { CardFace, SquareType } from '../core/types';

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const css = (c: number) => '#' + c.toString(16).padStart(6, '0');

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Top face of a board square. Text "up" points toward the board centre. */
export function tileTexture(index: number, type: SquareType): THREE.CanvasTexture {
  const w = 256;
  const h = 378; // matches the tile's width:depth ratio
  const { c, ctx } = canvas(w, h);
  const meta = SQUARE_META[type];
  const base = new THREE.Color(meta.color);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.18);
  const dark = base.clone().lerp(new THREE.Color(0x000000), 0.35);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#' + light.getHexString());
  g.addColorStop(1, '#' + dark.getHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const anchor = isAnchor(type);
  ctx.strokeStyle = anchor ? '#ffd76a' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = anchor ? 14 : 6;
  ctx.strokeRect(ctx.lineWidth / 2 + 4, ctx.lineWidth / 2 + 4, w - ctx.lineWidth - 8, h - ctx.lineWidth - 8);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `900 52px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.fillText(String(index), 22, 18);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `104px ${EMOJI}`;
  ctx.fillText(meta.icon, w / 2, h * 0.44);

  // Label: as large as fits the tile width.
  let size = 70;
  do {
    ctx.font = `900 ${size}px ${FONT}`;
  } while (ctx.measureText(meta.short).width > w - 26 && --size > 20);
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeText(meta.short, w / 2, h - 62);
  ctx.fillText(meta.short, w / 2, h - 62);
  return finish(c);
}

export interface PlaqueRow {
  label: string;
  seats: number;
  color: number;
}

/** Draws text shrunk (if needed) to fit `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, weight = 900): void {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
  } while (ctx.measureText(text).width > maxWidth && --px > 16);
  ctx.fillText(text, x, y);
}

/** Redraws an LED scoreboard (government or opposition bench) onto its canvas, in big type readable from afar. */
export function drawLedPlaque(c: HTMLCanvasElement, title: string, subtitle: string, seats: number, accent: string, rows: PlaqueRow[]): void {
  const ctx = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
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
  const seatsW = ctx.measureText(seatsText).width;
  ctx.fillText(seatsText, W - 28, 196);

  // Title and subtitle on the left.
  ctx.textAlign = 'left';
  const left = W - seatsW - 80;
  fitText(ctx, title, 30, 104, left, 104);
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = '#ffd76a';
  fitText(ctx, subtitle, 30, 170, left, 44, 800);

  // Party rows (largest first); a fourth party or more collapses into "+N more".
  const shown = rows.length > 3 ? rows.slice(0, 2) : rows;
  shown.forEach((r, i) => {
    const y = 290 + i * 76;
    ctx.shadowColor = css(r.color);
    ctx.fillStyle = css(r.color);
    ctx.fillRect(30, y - 46, 46, 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText(String(r.seats), W - 30, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f4f8';
    fitText(ctx, r.label, 96, y, W - 260, 58, 800);
  });
  if (rows.length > 3) {
    const rest = rows.slice(2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9d1de';
    ctx.shadowColor = '#c9d1de';
    fitText(ctx, `+ ${rest.length} more parties (${rest.reduce((n, r) => n + r.seats, 0)} seats)`, 30, 290 + 2 * 76, W - 60, 52, 800);
  }
  if (!rows.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7d8798';
    ctx.shadowBlur = 0;
    fitText(ctx, 'awaiting formation…', 30, 300, W - 60, 56, 800);
  }

  // LED pixel grid
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 2, H);
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
}

export function plaqueCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const { c } = canvas(1024, 480);
  return { canvas: c, texture: finish(c) };
}

/** Face of a drawn card, as shown during the draw animation. */
export function cardFaceTexture(face: CardFace, color: number): THREE.CanvasTexture {
  const W = 480;
  const H = 672;
  const { c, ctx } = canvas(W, H);
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
  const titleLines = wrap(ctx, face.title, W - 76).slice(0, 3);
  titleLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 152 + i * 50));
  let y = 152 + titleLines.length * 50 - 10;
  ctx.fillStyle = css(color);
  ctx.fillRect(60, y, W - 120, 5);
  y += 44;

  // Flavor
  ctx.fillStyle = '#4a4f5c';
  ctx.font = `italic 500 25px ${FONT}`;
  for (const ln of wrap(ctx, face.flavor, W - 80).slice(0, 4)) {
    ctx.fillText(ln, W / 2, y);
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
    lines = wrap(ctx, face.text, W - 80);
  } while (y + lines.length * size * 1.3 > H - 36 && --size > 14);
  for (const ln of lines) {
    ctx.fillText(ln, W / 2, y);
    y += size * 1.3;
  }
  return finish(c);
}

/** Big glowing headline floating over the chamber ("✔ PASSED", "✖ VETOED"). */
export function headlineTexture(text: string, color: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 216);
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
  return finish(c);
}

/** Floating popularity change shown above a pawn. */
export function floatTexture(text: string, color: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(256, 96);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 76px ${FONT}`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, 128, 50);
  ctx.fillStyle = css(color);
  ctx.fillText(text, 128, 50);
  return finish(c);
}

/** Roulette face: wedges 1..10 from dark red to dark green. Number k+1 sits at angle (k+0.5)·36°. */
export function wheelTexture(): THREE.CanvasTexture {
  const size = 1024;
  const { c, ctx } = canvas(size, size);
  const ctr = size / 2;
  const r = size / 2 - 6;
  const seg = (Math.PI * 2) / 10;
  for (let k = 0; k < 10; k++) {
    const hue = (k / 9) * 120;
    ctx.beginPath();
    ctx.moveTo(ctr, ctr);
    ctx.arc(ctr, ctr, r, k * seg, (k + 1) * seg);
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, 72%, ${30 + (k % 2) * 4}%)`;
    ctx.fill();
    ctx.strokeStyle = '#e8c35a';
    ctx.lineWidth = 6;
    ctx.stroke();

    const a = (k + 0.5) * seg;
    ctx.save();
    ctx.translate(ctr + Math.cos(a) * r * 0.78, ctr + Math.sin(a) * r * 0.78);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `900 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(String(k + 1), 0, 0);
    if (k + 1 === 6 || k + 1 === 9) ctx.fillRect(-26, 46, 52, 8); // tell 6 from 9 at any angle
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(ctr, ctr, r, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#e8c35a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ctr, ctr, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#141a26';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.stroke();
  return finish(c);
}

/** Tag floating above a pawn: a big party emblem in the centre, with the short name underneath. */
export function labelTexture(text: string, color: number, icon = ''): THREE.CanvasTexture {
  const { c, ctx } = canvas(256, 240);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (icon) {
    // Emblem disc
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
    ctx.font = `86px ${EMOJI}`;
    ctx.fillText(icon, 128, 86);
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
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  fitText(ctx, text, 128, 202, 180, 44, 900);
  return finish(c);
}

export function deckTexture(title: string, icon: string, color: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(360, 504);
  const base = new THREE.Color(color);
  const g = ctx.createLinearGradient(0, 0, 360, 504);
  g.addColorStop(0, '#' + base.clone().lerp(new THREE.Color(0xffffff), 0.15).getHexString());
  g.addColorStop(1, '#' + base.clone().lerp(new THREE.Color(0x000000), 0.4).getHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 360, 504);
  ctx.strokeStyle = '#e8c35a';
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, 332, 476);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `150px ${EMOJI}`;
  ctx.fillText(icon, 180, 210);
  ctx.fillStyle = '#fff';
  ctx.font = `900 40px ${FONT}`;
  wrap(ctx, title, 300).forEach((ln, i) => ctx.fillText(ln, 180, 370 + i * 46));
  return finish(c);
}

export function titleTexture(text: string, sub: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8c35a';
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText(text, 512, 110);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(sub, 512, 205);
  return finish(c);
}

/** Canvas + texture for the Prime Minister's portrait (redrawn whenever the PM changes). */
export function portraitCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const { c } = canvas(512, 768);
  return { canvas: c, texture: finish(c) };
}

/** Mixes two colours: t = 0 gives `a`, t = 1 gives `b`. */
const mix = (a: number, b: number, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/**
 * A propaganda-poster portrait of the Prime Minister: the leader's bust in a buttoned tunic before a
 * sunburst in the party's colour, the party emblem on the chest and a title plate below.
 * `party` null = no government yet: an empty, greyed-out frame.
 */
export function drawPortrait(c: HTMLCanvasElement, party: { name: string; icon: string; color: number } | null, title: string, sub: string): void {
  const ctx = c.getContext('2d')!;
  const W = c.width;
  const PH = 600; // painting height; the title plate fills the rest
  const H = c.height;
  const color = party?.color ?? 0x59606e;
  const cx = W / 2;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // ── Sunburst background in the party colour ──
  ctx.fillStyle = mix(color, 0x000000, 0.25);
  ctx.fillRect(0, 0, W, PH);
  const sx = cx;
  const sy = 250;
  const rays = 36;
  ctx.fillStyle = mix(color, 0xfff4d6, party ? 0.35 : 0.15);
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a0) * 900, sy + Math.sin(a0) * 900);
    ctx.lineTo(sx + Math.cos(a1) * 900, sy + Math.sin(a1) * 900);
    ctx.closePath();
    ctx.fill();
  }
  // Glowing halo behind the head.
  const halo = ctx.createRadialGradient(sx, sy, 20, sx, sy, 260);
  halo.addColorStop(0, 'rgba(255, 245, 210, 0.75)');
  halo.addColorStop(0.5, 'rgba(255, 230, 170, 0.25)');
  halo.addColorStop(1, 'rgba(255, 230, 170, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, PH);
  // Vignette.
  const vig = ctx.createRadialGradient(cx, PH / 2, PH * 0.35, cx, PH / 2, PH * 0.8);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, PH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, PH);
  ctx.clip();
  const ghost = !party;
  const skin = ghost ? '#2a2e36' : '#e7bb92';
  const skinShade = ghost ? '#22262d' : '#c99570';
  const suit = ghost ? '#23272e' : mix(0x56606a, color, 0.12);
  const suitDark = ghost ? '#1c1f25' : mix(0x323840, color, 0.1);

  // ── Shoulders in a buttoned, high-collared tunic ──
  const body = ctx.createLinearGradient(40, 0, W - 40, 0);
  body.addColorStop(0, suitDark);
  body.addColorStop(0.45, suit);
  body.addColorStop(1, suitDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(10, PH);
  ctx.bezierCurveTo(20, 500, 90, 445, 200, 418);
  ctx.lineTo(312, 418);
  ctx.bezierCurveTo(422, 445, 492, 500, W - 10, PH);
  ctx.closePath();
  ctx.fill();

  // Neck.
  const neck = ctx.createLinearGradient(210, 0, 302, 0);
  neck.addColorStop(0, skinShade);
  neck.addColorStop(0.5, skin);
  neck.addColorStop(1, skinShade);
  ctx.fillStyle = neck;
  ctx.fillRect(212, 330, 88, 100);

  if (!ghost) {
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
    ctx.lineTo(cx, PH);
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
    // Party badge pinned on the chest.
    ctx.fillStyle = '#e8c35a';
    ctx.beginPath();
    ctx.arc(166, 488, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.arc(166, 488, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `28px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(party.icon, 166, 490);
  }

  // ── Head: swept-back hair, ears, then the face ──
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
    // No Prime Minister yet: a question mark where the face would be.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `900 150px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, 285);
  } else {
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
      const g = ctx.createRadialGradient(cx + side * 52, 300, 2, cx + side * 52, 300, 26);
      g.addColorStop(0, 'rgba(230, 120, 100, 0.35)');
      g.addColorStop(1, 'rgba(230, 120, 100, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx + side * 52 - 30, 270, 60, 60);
    }
  }
  ctx.restore();

  // Varnish sheen and an inner gilt border.
  const sheen = ctx.createLinearGradient(0, 0, W, PH);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, PH);
  ctx.strokeStyle = '#e8c35a';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, PH - 28);

  // ── Title plate ──
  const plate = ctx.createLinearGradient(0, PH, 0, H);
  plate.addColorStop(0, mix(color, 0x000000, 0.35));
  plate.addColorStop(1, mix(color, 0x000000, 0.6));
  ctx.fillStyle = plate;
  ctx.fillRect(0, PH, W, H - PH);
  ctx.fillStyle = '#e8c35a';
  ctx.fillRect(0, PH, W, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffd76a';
  fitText(ctx, title, cx, PH + 76, W - 40, 56);
  ctx.fillStyle = '#fff4dc';
  fitText(ctx, sub, cx, PH + 132, W - 40, 32, 700);
  ctx.restore();
}

/** A brass-edged name plate for a lectern. */
export function nameplateTexture(text: string, accent: string): THREE.CanvasTexture {
  const W = 512;
  const H = 216;
  const { c, ctx } = canvas(W, H);
  const wood = ctx.createLinearGradient(0, 0, 0, H);
  wood.addColorStop(0, '#3b2414');
  wood.addColorStop(1, '#22140b');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d4a83a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = accent;
  ctx.fillRect(24, H - 46, W - 48, 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe7a3';
  const words = text.split(' ');
  if (words.length > 2) {
    const mid = Math.ceil(words.length / 2);
    fitText(ctx, words.slice(0, mid).join(' '), W / 2, 62, W - 60, 56);
    fitText(ctx, words.slice(mid).join(' '), W / 2, 126, W - 60, 56);
  } else fitText(ctx, text, W / 2, 96, W - 60, 72);
  return finish(c);
}
