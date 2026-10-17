/**
 * The game's sound effects, synthesized (no audio files needed). Each recipe gets the synth and an optional
 * duration in seconds (for sounds that last as long as an animation, like the escalator or the vote count).
 * Notes are written as semitones from A4 (0 = A4, 3 = C5, 7 = E5, 10 = G5, 12 = A5, 15 = C6).
 */
import { note, type Synth } from './synth';

export type SoundName =
  | 'click'
  | 'tick'
  | 'wheelStop'
  | 'hop'
  | 'escalator'
  | 'helicopter'
  | 'cardDraw'
  | 'cardDeal'
  | 'turn'
  | 'news'
  | 'breaking'
  | 'good'
  | 'bad'
  | 'popUp'
  | 'popDown'
  | 'billPassed'
  | 'billVetoed'
  | 'opposition'
  | 'portrait'
  | 'footsteps'
  | 'drumroll'
  | 'electionResult'
  | 'gameOver';

/** A brass-like chord: detuned sawtooth voices through a low-pass filter. */
function brass(s: Synth, notes: number[], at: number, dur: number, vol = 0.07): void {
  for (const n of notes) {
    for (const detune of [-0.08, 0.08]) {
      s.tone({ freq: note(n + detune), type: 'sawtooth', at, dur, vol, attack: 0.04, lowpass: 1800 });
    }
  }
}

/** A crowd: a swelling band of noise with a few random bumps. */
function crowd(s: Synth, at: number, dur: number, freq: number, vol: number): void {
  s.noise({ at, dur, vol, attack: dur * 0.35, filter: 'bandpass', freq, q: 0.7 });
  for (let i = 0; i < 6; i++) {
    s.noise({
      at: at + Math.random() * dur * 0.7,
      dur: 0.25,
      vol: vol * 0.6,
      filter: 'bandpass',
      freq: freq * (0.8 + Math.random() * 0.6),
      q: 2,
    });
  }
}

/** A wooden knock (gavel, footstep). */
function knock(s: Synth, at: number, vol = 0.35): void {
  s.tone({ freq: 180, to: 90, type: 'sine', at, dur: 0.12, vol });
  s.noise({ at, dur: 0.05, vol: vol * 0.5, filter: 'lowpass', freq: 1200 });
}

export const SOUNDS: Record<SoundName, (s: Synth, duration?: number) => void> = {
  // Interface button.
  click: (s) => s.tone({ freq: 1400, to: 900, type: 'triangle', dur: 0.05, vol: 0.08 }),

  // A peg of the roulette wheel passing the pointer.
  tick: (s) => {
    s.tone({ freq: 2600, type: 'square', dur: 0.015, vol: 0.035, lowpass: 5000 });
    s.noise({ dur: 0.02, vol: 0.05, filter: 'highpass', freq: 3000 });
  },

  // The wheel comes to rest: a bright two-note chime.
  wheelStop: (s) => {
    s.tone({ freq: note(19), type: 'triangle', dur: 0.5, vol: 0.12 });
    s.tone({ freq: note(26), type: 'triangle', at: 0.09, dur: 0.6, vol: 0.1 });
  },

  // A pawn hopping one square.
  hop: (s) => s.tone({ freq: 330, to: 560, type: 'triangle', dur: 0.09, vol: 0.09 }),

  // The escalator carrying a pawn down: a motor hum with a clack on every tread.
  escalator: (s, duration = 2.5) => {
    s.tone({ freq: 55, type: 'sawtooth', dur: duration, vol: 0.05, attack: 0.2, lowpass: 260 });
    s.tone({ freq: 110, type: 'triangle', dur: duration, vol: 0.03, attack: 0.2 });
    for (let t = 0.15; t < duration - 0.1; t += 0.22)
      s.noise({ at: t, dur: 0.03, vol: 0.05, filter: 'bandpass', freq: 2200, q: 4 });
  },

  // The President's helicopter: the thump of the rotor blades over a turbine whine, fading in and out.
  helicopter: (s, duration = 7) => {
    s.tone({ freq: 420, to: 460, type: 'sawtooth', dur: duration, vol: 0.012, attack: 1, lowpass: 900 });
    for (let t = 0; t < duration; t += 0.075) {
      const swell = Math.min(1, t / 1.2, (duration - t) / 1.5);
      s.noise({ at: t, dur: 0.06, vol: 0.09 * Math.max(0.15, swell), filter: 'lowpass', freq: 260 });
    }
  },

  // A card sliding off a deck.
  cardDraw: (s) => s.noise({ dur: 0.28, vol: 0.18, attack: 0.03, filter: 'bandpass', freq: 700, to: 3500, q: 1.2 }),
  cardDeal: (s) => s.noise({ dur: 0.09, vol: 0.1, attack: 0.01, filter: 'bandpass', freq: 1500, to: 4000, q: 1.5 }),

  // "Now playing": a soft bell.
  turn: (s) => {
    s.tone({ freq: note(12), type: 'sine', dur: 0.9, vol: 0.12 });
    s.tone({ freq: note(24), type: 'sine', dur: 0.6, vol: 0.04 });
  },

  // A news story: a calm two-note "ding-dong".
  news: (s) => {
    s.tone({ freq: note(15), type: 'sine', dur: 0.35, vol: 0.1 });
    s.tone({ freq: note(10), type: 'sine', at: 0.16, dur: 0.5, vol: 0.1 });
  },

  // Breaking news: a TV-style sting with a low hit.
  breaking: (s) => {
    s.tone({ freq: 70, to: 45, type: 'sine', dur: 0.45, vol: 0.3 });
    [3, 10, 15].forEach((n, i) =>
      s.tone({ freq: note(n), type: 'square', at: i * 0.09, dur: 0.22, vol: 0.05, lowpass: 2600 }),
    );
    s.tone({ freq: note(15), type: 'triangle', at: 0.27, dur: 0.6, vol: 0.08 });
  },

  // Good news: a quick major arpeggio.
  good: (s) =>
    [3, 7, 10, 15].forEach((n, i) => s.tone({ freq: note(n), type: 'triangle', at: i * 0.07, dur: 0.35, vol: 0.09 })),

  // A setback: two falling minor notes.
  bad: (s) => {
    s.tone({ freq: note(0), type: 'sawtooth', dur: 0.3, vol: 0.14, lowpass: 1200 });
    s.tone({ freq: note(-4), type: 'sawtooth', at: 0.2, dur: 0.5, vol: 0.14, lowpass: 900 });
  },

  // Popularity going up or down (the floating numbers over the pawns).
  popUp: (s) => s.tone({ freq: 600, to: 950, type: 'sine', dur: 0.12, vol: 0.07 }),
  popDown: (s) => s.tone({ freq: 480, to: 280, type: 'sine', dur: 0.15, vol: 0.07 }),

  // A bill becomes law: the gavel, then the chamber cheers.
  billPassed: (s) => {
    knock(s, 0);
    knock(s, 0.18);
    crowd(s, 0.25, 2.2, 1400, 0.12);
    [3, 7, 10].forEach((n, i) =>
      s.tone({ freq: note(n + 12), type: 'triangle', at: 0.3 + i * 0.08, dur: 0.5, vol: 0.06 }),
    );
  },

  // A veto: a buzzer, then the chamber boos.
  billVetoed: (s) => {
    s.tone({ freq: 110, type: 'sawtooth', dur: 0.55, vol: 0.09, lowpass: 900 });
    s.tone({ freq: 116, type: 'sawtooth', dur: 0.55, vol: 0.06, lowpass: 900 });
    crowd(s, 0.35, 2, 380, 0.14);
  },

  // The opposition forms: a low, determined brass call.
  opposition: (s) => {
    brass(s, [-12, -5], 0, 0.4, 0.06);
    brass(s, [-9, -2], 0.42, 0.9, 0.06);
  },

  // The Leader of Congress's portrait is revealed: a whoosh and a short fanfare.
  portrait: (s) => {
    s.noise({ dur: 0.5, vol: 0.12, attack: 0.25, filter: 'bandpass', freq: 400, to: 4000 });
    brass(s, [-9, -5, -2], 0.45, 0.25);
    brass(s, [-9, -5, -2, 3], 0.72, 1.1);
  },

  // MPs walking across the chamber.
  footsteps: (s, duration = 2.5) => {
    for (let t = 0; t < duration; t += 0.21) knock(s, t, 0.12);
  },

  // The vote count on election night: a snare roll that builds up.
  drumroll: (s, duration = 7) => {
    for (let t = 0; t < duration; t += 0.045) {
      const swell = 0.03 + 0.07 * (t / duration);
      s.noise({ at: t, dur: 0.05, vol: swell, filter: 'bandpass', freq: 1800, q: 0.8 });
    }
  },

  // The election result: a cymbal and a fanfare.
  electionResult: (s) => {
    s.noise({ dur: 1.6, vol: 0.12, filter: 'highpass', freq: 5000 });
    s.tone({ freq: 60, to: 40, type: 'sine', dur: 0.6, vol: 0.35 });
    brass(s, [-9, -5, -2], 0, 0.22);
    brass(s, [-9, -5, -2], 0.24, 0.22);
    brass(s, [-7, -3, 0, 5], 0.5, 1.3);
  },

  // The end of the game: a longer fanfare.
  gameOver: (s) => {
    s.noise({ dur: 2, vol: 0.1, filter: 'highpass', freq: 5000 });
    [
      [[-9, -5, -2], 0, 0.3],
      [[-7, -3, 0], 0.32, 0.3],
      [[-5, -2, 3], 0.64, 0.3],
      [[-9, -5, -2, 3], 0.96, 1.6],
    ].forEach(([notes, at, dur]) => brass(s, notes as number[], at as number, dur as number, 0.07));
  },
};
