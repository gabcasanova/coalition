import type * as THREE from 'three';
import type { CameraDirector } from './CameraDirector';

/** What every part of the 3D table shares: the scene, the camera director and the animation clock. */
export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly director: CameraDirector;
  /** Runs `fn(k)` every frame for `seconds` of game time, with k from 0 to 1 (see animation.ts). */
  tween(seconds: number, fn: (k: number) => void): Promise<void>;
  /** Resolves after `seconds` of game time. */
  wait(seconds: number): Promise<void>;
}
