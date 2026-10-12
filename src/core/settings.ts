/** Runtime presentation settings shared by the engine, AI and renderer. */
export const settings = {
  /** Animation / pacing multiplier: 1 = normal, 2 = fast, 4 = turbo. */
  speed: 1,
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A duration in ms scaled by the current game speed. */
export const paced = (ms: number) => ms / settings.speed;
