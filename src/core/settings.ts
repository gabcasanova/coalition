/** Runtime presentation settings shared by the engine, AI and renderer. */
export const settings = {
  /** Animation / pacing multiplier: 1 = normal, 2 = fast, 4 = turbo. */
  speed: 1,
  /** Debug fast-forward (Ctrl+Q menu): bots play every party, nothing waits and animations race. */
  fastForward: false,
};

/** Animation speed while fast-forwarding. */
const FAST_FORWARD_SPEED = 40;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A duration in ms scaled by the current game speed (no wait at all while fast-forwarding). */
export const paced = (ms: number) => (settings.fastForward ? 0 : ms / settings.speed);

/** The multiplier animations run at right now. */
export const animationSpeed = () => (settings.fastForward ? FAST_FORWARD_SPEED : settings.speed);

let fastForwardAbort = new AbortController();

/** Aborted when a fast-forward starts, so open news windows and prompts close and let the bots carry on. */
export const fastForwardSignal = () => fastForwardAbort.signal;

export function setFastForward(on: boolean): void {
  if (on === settings.fastForward) return;
  settings.fastForward = on;
  if (on) fastForwardAbort.abort();
  else fastForwardAbort = new AbortController();
}
