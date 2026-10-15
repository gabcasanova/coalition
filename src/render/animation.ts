/**
 * Frame-driven animations ("tweens"). A tween calls `fn(k)` every frame with progress `k` going from 0 to 1, then
 * resolves its promise, so animations can be chained with `await`. Durations are in seconds of game time: they
 * run faster when the player raises the game speed.
 */

export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

interface Tween {
  /** Seconds elapsed so far. */
  t: number;
  /** Total duration in seconds. */
  duration: number;
  fn: (k: number) => void;
  done: () => void;
}

export class Tweens {
  private running: Tween[] = [];

  /** Runs `fn(k)` every frame for `seconds`, with k from 0 to 1; resolves when finished. */
  add(seconds: number, fn: (k: number) => void): Promise<void> {
    return new Promise((done) => this.running.push({ t: 0, duration: seconds, fn, done }));
  }

  /** Resolves after `seconds` of game time. */
  wait(seconds: number): Promise<void> {
    return this.add(seconds, () => {});
  }

  /** Advances every tween by `dt` real seconds, multiplied by the game `speed`. */
  update(dt: number, speed: number): void {
    if (!this.running.length) return;
    const stillRunning: Tween[] = [];
    for (const tween of this.running) {
      tween.t += dt * speed;
      const k = Math.min(1, tween.t / tween.duration);
      tween.fn(k);
      // Resolving the promise runs the awaiting code after this frame.
      if (k >= 1) tween.done();
      else stillRunning.push(tween);
    }
    this.running = stillRunning;
  }
}
