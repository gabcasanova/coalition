/**
 * Tiny synthesizer on top of the Web Audio API: enveloped tones and filtered noise. The game's sound effects
 * (sounds.ts) are built from these two building blocks, so the game needs no audio files.
 */

export interface ToneOptions {
  /** Start frequency in Hz. */
  freq: number;
  /** Glide to this frequency by the end of the note. */
  to?: number;
  type?: OscillatorType;
  /** Seconds after "now" the note starts. */
  at?: number;
  /** Length in seconds. */
  dur: number;
  /** Peak volume (0..1). */
  vol?: number;
  /** Fade-in time in seconds. */
  attack?: number;
  /** Low-pass filter cutoff in Hz (softens bright waveforms). */
  lowpass?: number;
}

export interface NoiseOptions {
  at?: number;
  dur: number;
  vol?: number;
  attack?: number;
  /** How the noise is shaped: a band-pass gives a "whoosh", a low-pass a rumble, a high-pass a hiss. */
  filter?: BiquadFilterType;
  /** Filter frequency in Hz, and where it sweeps to by the end. */
  freq?: number;
  to?: number;
  q?: number;
}

export class Synth {
  private noiseBuffer: AudioBuffer | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  /** An oscillator note with a quick attack and an exponential fade-out. */
  tone(o: ToneOptions): void {
    const { ctx } = this;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const t1 = t0 + o.dur;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t1);
    const gain = this.envelope(t0, t1, o.vol ?? 0.3, o.attack ?? 0.005);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    osc.start(t0);
    osc.stop(t1 + 0.05);
  }

  /** A burst of filtered white noise (whooshes, thumps, crowds, snare hits). */
  noise(o: NoiseOptions): void {
    const { ctx } = this;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const t1 = t0 + o.dur;
    const source = ctx.createBufferSource();
    source.buffer = this.whiteNoise();
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq ?? 1000, t0);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t1);
    filter.Q.value = o.q ?? 1;
    source.connect(filter).connect(this.envelope(t0, t1, o.vol ?? 0.3, o.attack ?? 0.005));
    source.start(t0, Math.random()); // start at a random point so repeated hits don't sound identical
    source.stop(t1 + 0.05);
  }

  /** A gain node that fades in over `attack`, then decays exponentially until `end`. */
  private envelope(start: number, end: number, peak: number, attack: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(this.out);
    return gain;
  }

  /** One second of white noise, made once and reused. */
  private whiteNoise(): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }
}

/** Frequency of a note: semitones above (or below) A4 = 440 Hz. */
export const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
