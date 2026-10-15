import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Where the camera should be and what it looks at. */
export interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** How quickly the camera glides toward this pose (higher = snappier). */
  rate: number;
}

/** Framings for following a pawn: from far to close. */
export type PawnShot = 'medium' | 'follow' | 'close';

/**
 * The cinematic camera. Game code asks for a shot (the wheel, the parliament, a moving pawn…) and the director
 * glides the camera toward it every frame. Dragging the camera by hand pauses the director for a few seconds.
 * When `cinematic` is off, the camera is fully manual.
 */
export class CameraDirector {
  cinematic = false;
  /** Seconds since the scene started (real time). */
  time = 0;
  private shot: () => Pose = () => CameraDirector.overviewPose();
  private userDragging = false;
  private userHoldUntil = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
  ) {
    controls.addEventListener('start', () => (this.userDragging = true));
    controls.addEventListener('end', () => {
      this.userDragging = false;
      this.userHoldUntil = this.time + 4;
    });
  }

  /** The whole table, from the camera side. */
  static overviewPose(): Pose {
    return { pos: new THREE.Vector3(0, 46, 46), target: new THREE.Vector3(0, 0, 1), rate: 1.6 };
  }

  /** Sets the shot: a fixed pose, or a function evaluated every frame (to follow something that moves). */
  frame(shot: Pose | (() => Pose)): void {
    this.shot = typeof shot === 'function' ? shot : () => shot;
  }

  overview(): void {
    this.frame(() => CameraDirector.overviewPose());
  }

  wheel(): void {
    this.frame({ pos: new THREE.Vector3(0, 21, 25), target: new THREE.Vector3(0, 0.6, 1.5), rate: 2.6 });
  }

  parliament(): void {
    this.frame({ pos: new THREE.Vector3(0, 24, 17), target: new THREE.Vector3(0, 2, -9), rate: 2 });
  }

  /** Follows an object on the track from outside the ring, looking inward so its square is readable. */
  followFromOutside(object: THREE.Object3D, kind: PawnShot): void {
    const [back, up, rate] = kind === 'medium' ? [25, 20, 2] : kind === 'follow' ? [18, 14, 3] : [14, 11, 2.4];
    this.frame(() => {
      const p = object.position;
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      return {
        pos: new THREE.Vector3(p.x + out.x * back, p.y + up, p.z + out.z * back),
        target: new THREE.Vector3(p.x - out.x * 2, p.y + 0.6, p.z - out.z * 2),
        rate,
      };
    });
  }

  /** Moves the camera a step toward the current shot. `speed` is the game speed (faster game, snappier camera). */
  update(dt: number, speed: number): void {
    this.time += dt;
    if (!this.cinematic || this.userDragging || this.time < this.userHoldUntil) return;
    const shot = this.shot();
    // Narrow (portrait) screens see less horizontally, so pull the camera back.
    const back = THREE.MathUtils.clamp(1.3 / this.camera.aspect, 1, 1.5);
    const pos = shot.pos.clone().sub(shot.target).multiplyScalar(back).add(shot.target);
    const k = 1 - Math.exp(-shot.rate * dt * Math.min(speed, 2.5));
    this.camera.position.lerp(pos, k);
    this.controls.target.lerp(shot.target, k);
  }
}
