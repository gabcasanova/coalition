import { AIController } from '../core/ai';
import { fastForwardSignal, settings } from '../core/settings';
import type { Controller, Prompt } from '../core/types';
import type { Hud } from './hud/Hud';

/** Routes decisions to the on-screen prompt UI; while the debug menu fast-forwards, a bot decides instead. */
export class HumanController implements Controller {
  private readonly bot = new AIController();

  constructor(private hud: Hud) {}

  async choose(prompt: Prompt): Promise<number> {
    if (settings.fastForward) return this.bot.choose(prompt);
    const i = await this.hud.prompt(prompt, fastForwardSignal());
    // -1: a fast-forward started while the prompt was open.
    return i >= 0 ? i : this.bot.choose(prompt);
  }

  async chooseMany(prompt: Prompt, count: number): Promise<number[]> {
    if (settings.fastForward) return this.bot.chooseMany(prompt, count);
    const picks = await this.hud.draft(prompt, count, fastForwardSignal());
    // null: a fast-forward started while the draft was open.
    return picks ?? this.bot.chooseMany(prompt, count);
  }
}
