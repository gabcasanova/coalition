/** Helpers for painting textures on a 2D canvas. */
import * as THREE from 'three';
import { THEME } from '../../assets/theme';

export const FONT = THEME.font;
export const EMOJI_FONT = THEME.emojiFont;

/** A hex colour number as a CSS colour string (0xff8800 → "#ff8800"). */
export const css = (color: number) => '#' + color.toString(16).padStart(6, '0');

/** Mixes two colours: t = 0 gives `a`, t = 1 gives `b`. Returns a CSS colour. */
export const mix = (a: number, b: number, t: number) =>
  '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

export function makeCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/** Wraps a finished canvas as a texture (sRGB colours, sharp at grazing angles). */
export function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Splits text into lines no wider than `maxWidth` with the current font. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

/** Draws text at `size` px, shrinking it if needed to fit `maxWidth`. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = 900,
): void {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
  } while (ctx.measureText(text).width > maxWidth && --px > 16);
  ctx.fillText(text, x, y);
}

/** Draws an image so it covers the rectangle completely (cropping the overflow), like CSS `object-fit: cover`. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Draws a party emblem centred at (x, y): the image from the assets if there is one, otherwise the emoji. */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  icon: string,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
): void {
  if (image) {
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    return;
  }
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y);
}
