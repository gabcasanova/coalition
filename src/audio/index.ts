/**
 * Sound effects. `sound.play('hop')` plays a sound: a file from public/assets (see the "sounds" section of
 * manifest.json) if one was provided, otherwise the synthesized version from sounds.ts.
 *
 * Browsers only allow audio after the player has interacted with the page, so the audio starts on the first
 * click or key press. The mute setting is remembered between visits.
 */
import { soundFile } from '../assets';
import { SOUNDS, type SoundName } from './sounds';
import { Synth } from './synth';

export type { SoundName };

const MUTE_KEY = 'coalition.muted';
/** Overall volume (0..1). */
const MASTER_VOLUME = 0.85;
/** The same sound is not repeated more often than this (ms), so bursts don't turn into noise. */
const MIN_GAP_MS: Partial<Record<SoundName, number>> = {
  tick: 25,
  cardDeal: 40,
  hop: 60,
  popUp: 80,
  popDown: 80,
  click: 40,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let synth: Synth | null = null;
const decoded = new Map<SoundName, AudioBuffer>();
const lastPlayed = new Map<SoundName, number>();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
let muted = loadMuted();

/** Creates the audio context (once) and resumes it; must run inside a user gesture the first time. */
function unlock(): void {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    synth = new Synth(ctx, master);
    decodeReplacementFiles(ctx);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Decodes the sound files listed in the manifest, if any. */
function decodeReplacementFiles(context: AudioContext): void {
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    const file = soundFile(name);
    if (!file) continue;
    context
      .decodeAudioData(file.slice(0))
      .then((buffer) => decoded.set(name, buffer))
      .catch(() => console.warn(`[assets] sound ${name}: could not decode the file`));
  }
}

for (const event of ['pointerdown', 'keydown'] as const) window.addEventListener(event, unlock, { capture: true });

export const sound = {
  /** Plays a sound. `duration` (seconds) stretches sounds that follow an animation (escalator, drumroll, footsteps). */
  play(name: SoundName, duration?: number): void {
    if (muted || !ctx || !synth || ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) ?? -Infinity) < (MIN_GAP_MS[name] ?? 0)) return;
    lastPlayed.set(name, now);

    const file = decoded.get(name);
    if (file) {
      const source = ctx.createBufferSource();
      source.buffer = file;
      source.connect(master!);
      source.start();
      if (duration) source.stop(ctx.currentTime + duration);
      return;
    }
    SOUNDS[name](synth, duration);
  },

  get muted(): boolean {
    return muted;
  },

  set muted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* storage unavailable: the choice lasts until the page is closed */
    }
    if (master && ctx) master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
  },
};

// Every button in the interface clicks.
document.addEventListener(
  'click',
  (e) => {
    if ((e.target as HTMLElement).closest('button')) sound.play('click');
  },
  { capture: true },
);
