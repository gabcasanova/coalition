/** Textures of the board itself: the squares, the roulette wheel, the deck backs and the floor titles. */
import * as THREE from 'three';
import { image } from '../../assets';
import { THEME } from '../../assets/theme';
import { isAnchor } from '../../core/board';
import type { DeckKind, SquareType } from '../../core/types';
import { SQUARE_META } from '../../data/squares';
import { css, drawCover, EMOJI_FONT, fitText, FONT, makeCanvas, toTexture, wrapText } from './canvas';

/** Top face of a board square, 256×378 px. Text "up" points toward the board centre. */
export function tileTexture(index: number, type: SquareType): THREE.CanvasTexture {
  const w = 256;
  const h = 378; // matches the square's width:depth ratio
  const { canvas, ctx } = makeCanvas(w, h);
  const art = image(`tile.${type}`);

  if (art) {
    drawCover(ctx, art, 0, 0, w, h);
  } else {
    const meta = SQUARE_META[type];
    const base = new THREE.Color(meta.color);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#' + base.clone().lerp(new THREE.Color(0xffffff), 0.18).getHexString());
    gradient.addColorStop(1, '#' + base.clone().lerp(new THREE.Color(0x000000), 0.35).getHexString());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // The four fixed squares get a thick gold border.
    const anchor = isAnchor(type);
    ctx.strokeStyle = anchor ? '#ffd76a' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = anchor ? 14 : 6;
    ctx.strokeRect(ctx.lineWidth / 2 + 4, ctx.lineWidth / 2 + 4, w - ctx.lineWidth - 8, h - ctx.lineWidth - 8);

    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `104px ${EMOJI_FONT}`;
    ctx.fillText(meta.icon, w / 2, h * 0.44);

    // Label: as large as fits the square's width.
    let size = 70;
    do {
      ctx.font = `900 ${size}px ${FONT}`;
    } while (ctx.measureText(meta.short).width > w - 26 && --size > 20);
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(meta.short, w / 2, h - 62);
    ctx.fillText(meta.short, w / 2, h - 62);
  }

  // The square number, always drawn (also over custom art).
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `900 52px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.fillText(String(index), 22, 18);
  return toTexture(canvas);
}

/** Roulette face, 1024×1024 px: wedges 1..10 from dark red to dark green. Number k+1 sits at angle (k+0.5)·36°. */
export function wheelTexture(): THREE.CanvasTexture {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);
  const art = image('wheel');
  if (art) {
    ctx.drawImage(art, 0, 0, size, size);
    return toTexture(canvas);
  }

  const centre = size / 2;
  const r = size / 2 - 6;
  const wedge = (Math.PI * 2) / 10;
  const gold = css(THEME.gold);
  for (let k = 0; k < 10; k++) {
    const hue = (k / 9) * 120;
    ctx.beginPath();
    ctx.moveTo(centre, centre);
    ctx.arc(centre, centre, r, k * wedge, (k + 1) * wedge);
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, 72%, ${30 + (k % 2) * 4}%)`;
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 6;
    ctx.stroke();

    const a = (k + 0.5) * wedge;
    ctx.save();
    ctx.translate(centre + Math.cos(a) * r * 0.78, centre + Math.sin(a) * r * 0.78);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `900 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(String(k + 1), 0, 0);
    if (k + 1 === 6 || k + 1 === 9) ctx.fillRect(-26, 46, 52, 8); // underline to tell 6 from 9 at any angle
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(centre, centre, r, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centre, centre, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#141a26';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.stroke();
  return toTexture(canvas);
}

/** The back of a deck of cards, 360×504 px: its icon and title on the deck colour. */
export function deckTexture(kind: DeckKind, title: string, icon: string, color: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(360, 504);
  const art = image(`deck.${kind}`);
  if (art) {
    drawCover(ctx, art, 0, 0, 360, 504);
    return toTexture(canvas);
  }

  const base = new THREE.Color(color);
  const gradient = ctx.createLinearGradient(0, 0, 360, 504);
  gradient.addColorStop(0, '#' + base.clone().lerp(new THREE.Color(0xffffff), 0.15).getHexString());
  gradient.addColorStop(1, '#' + base.clone().lerp(new THREE.Color(0x000000), 0.4).getHexString());
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 360, 504);
  ctx.strokeStyle = css(THEME.gold);
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, 332, 476);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `150px ${EMOJI_FONT}`;
  ctx.fillText(icon, 180, 210);
  ctx.fillStyle = '#fff';
  ctx.font = `900 40px ${FONT}`;
  wrapText(ctx, title, 300).forEach((line, i) => ctx.fillText(line, 180, 370 + i * 46));
  return toTexture(canvas);
}

/** A gold title with a grey subtitle, painted on the table ("PARLIAMENT", "OVERALL STANDINGS"). */
export function titleTexture(text: string, subtitle: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(1024, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = css(THEME.gold);
  fitText(ctx, text, 512, 110, 980, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  fitText(ctx, subtitle, 512, 205, 980, 36, 600);
  return toTexture(canvas);
}
