import type { Controller, Prompt } from '../core/types';
import type { Hud } from './hud/Hud';

/** Routes decisions to the on-screen prompt UI. */
export class HumanController implements Controller {
  constructor(private hud: Hud) {}

  choose(prompt: Prompt): Promise<number> {
    return this.hud.prompt(prompt);
  }
}
