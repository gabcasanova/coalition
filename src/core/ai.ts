import { paced, sleep } from './settings';
import type { Controller, Prompt } from './types';

/**
 * Bot player. The engine scores every option from the chooser's perspective (`ai`),
 * so the bot just picks the best enabled option with a little noise for personality.
 * Its choices reach the viewer through the engine's news headlines, not as menus.
 */
export class AIController implements Controller {
  constructor(
    /** Pause before each decision so the viewer can follow the news. */
    private readonly thinkMs = 350,
    private readonly noise = 0.6,
  ) {}

  async choose(prompt: Prompt): Promise<number> {
    await sleep(paced(prompt.options.length > 1 ? this.thinkMs : this.thinkMs / 2));
    let best = -1;
    let bestScore = -Infinity;
    prompt.options.forEach((o, i) => {
      if (o.disabled) return;
      const s = o.ai + (Math.random() - 0.5) * this.noise;
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    return Math.max(best, 0);
  }
}
