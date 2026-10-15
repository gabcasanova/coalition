/**
 * Replaceable art.
 *
 * Every visual the game draws has a built-in placeholder generated in code. To use real art instead, put a file
 * in `public/assets/` and point to it from `public/assets/manifest.json`. Any slot left as `null` (or missing)
 * keeps the placeholder. See `public/assets/README.md` for sizes and conventions.
 *
 * `loadAssets()` runs once at startup, before the 3D scene is built; after that the getters below are synchronous.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { DeckKind, SquareType } from '../core/types';

/** Image slots: textures on the board, the decks, the wheel, the table and the PM's portrait. */
export type ImageSlot =
  `tile.${SquareType}` | `deck.${DeckKind}` | 'wheel' | 'table.wood' | 'table.felt' | 'portrait.leader';

/** 3D model slots (glTF / .glb). */
export type ModelSlot = 'pawn' | 'mp' | 'leader';

interface Manifest {
  images?: Partial<Record<ImageSlot, string | null>>;
  /** Party emblems by party key (see `key` in src/data/parties.ts). */
  emblems?: Record<string, string | null>;
  models?: Partial<Record<ModelSlot, string | null>>;
}

const BASE = `${import.meta.env.BASE_URL}assets/`;
const images = new Map<string, HTMLImageElement>();
const emblems = new Map<string, HTMLImageElement>();
const models = new Map<ModelSlot, THREE.Group>();

function loadImage(file: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load asset ${file}`));
    img.src = BASE + file;
  });
}

/** Reads the manifest and preloads every asset it names. Missing or broken files fall back to the placeholders. */
export async function loadAssets(): Promise<void> {
  let manifest: Manifest = {};
  try {
    const res = await fetch(BASE + 'manifest.json');
    if (res.ok) manifest = await res.json();
  } catch {
    return; // no manifest: placeholders everywhere
  }

  const jobs: Promise<void>[] = [];
  const tryLoad = (what: string, job: Promise<void>) =>
    jobs.push(job.catch((err) => console.warn(`[assets] ${what}: ${err.message ?? err}`)));

  for (const [slot, file] of Object.entries(manifest.images ?? {})) {
    if (file)
      tryLoad(
        slot,
        loadImage(file).then((img) => void images.set(slot, img)),
      );
  }
  for (const [key, file] of Object.entries(manifest.emblems ?? {})) {
    if (file)
      tryLoad(
        `emblem ${key}`,
        loadImage(file).then((img) => void emblems.set(key, img)),
      );
  }
  const gltf = new GLTFLoader();
  for (const [slot, file] of Object.entries(manifest.models ?? {}) as [ModelSlot, string | null][]) {
    if (file)
      tryLoad(
        slot,
        gltf.loadAsync(BASE + file).then((m) => void models.set(slot, m.scene)),
      );
  }
  await Promise.all(jobs);
}

/** The image for a slot, if one was provided. */
export const image = (slot: ImageSlot): HTMLImageElement | undefined => images.get(slot);

/** A party's emblem image, if one was provided (custom parties always use their emoji). */
export const emblemImage = (partyKey: string | undefined): HTMLImageElement | undefined =>
  partyKey ? emblems.get(partyKey) : undefined;

/** A fresh copy of a model, if one was provided. */
export const model = (slot: ModelSlot): THREE.Group | undefined => models.get(slot)?.clone(true);
