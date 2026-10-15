import * as THREE from 'three';
import { THEME } from '../../assets/theme';
import { sound } from '../../audio';
import { easeOutCubic } from '../animation';
import { WHEEL_R } from '../layout';
import type { Stage } from '../Stage';
import { wheelTexture } from '../textures/board';

/**
 * The roulette wheel in the middle of the table (numbers 1–10). Human players spin it by clicking it: `arm()`
 * makes it glow and resolves when it is clicked.
 */
export class Wheel {
  /** The part that turns. */
  private readonly disc = new THREE.Group();
  /** Pulsing ring shown while the wheel is waiting to be clicked. */
  private readonly glow: THREE.Mesh;
  private onClicked: (() => void) | null = null;

  constructor(private readonly stage: Stage) {
    const gold = new THREE.MeshStandardMaterial({ color: THEME.gold, metalness: 0.9, roughness: 0.25 });

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R + 0.5, WHEEL_R + 0.8, 0.8, 64),
      new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.5 }),
    );
    base.position.y = 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    stage.scene.add(base);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R + 0.35, 0.18, 12, 96), gold);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.95;
    stage.scene.add(rim);

    const face = new THREE.Mesh(
      new THREE.CircleGeometry(WHEEL_R, 96),
      new THREE.MeshStandardMaterial({ map: wheelTexture(), roughness: 0.35, metalness: 0.1 }),
    );
    face.rotation.x = -Math.PI / 2;
    face.receiveShadow = true;
    this.disc.add(face);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.8, 32), gold);
    hub.position.y = 0.4;
    hub.castShadow = true;
    this.disc.add(hub);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), gold);
    knob.position.y = 1.0;
    this.disc.add(knob);

    this.disc.position.y = 0.82;
    stage.scene.add(this.disc);

    // Pointer on the camera side of the wheel: the number under it is the result.
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xfff1b0, metalness: 0.6, roughness: 0.3, emissive: 0x6b5410 }),
    );
    pointer.geometry.rotateX(-Math.PI / 2);
    pointer.position.set(0, 1.25, WHEEL_R + 0.25);
    pointer.castShadow = true;
    stage.scene.add(pointer);

    this.glow = new THREE.Mesh(
      new THREE.TorusGeometry(WHEEL_R + 0.75, 0.16, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, toneMapped: false }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 1.0;
    this.glow.visible = false;
    stage.scene.add(this.glow);
  }

  /** True while the wheel is waiting for a click. */
  get armed(): boolean {
    return this.onClicked !== null;
  }

  /** Waits for the player to click the wheel. */
  arm(): Promise<void> {
    if (this.stage.director.cinematic) this.stage.director.wheel();
    this.glow.visible = true;
    return new Promise((resolve) => (this.onClicked = resolve));
  }

  disarm(): void {
    this.onClicked = null;
    this.glow.visible = false;
  }

  /** Called by the scene when the player clicked the wheel. */
  click(): void {
    const resolve = this.onClicked;
    this.disarm();
    resolve?.();
  }

  /** Does this ray hit the wheel (or its glow ring)? */
  isHitBy(raycaster: THREE.Raycaster): boolean {
    return (
      raycaster.intersectObject(this.disc, true).length > 0 || raycaster.intersectObject(this.glow, false).length > 0
    );
  }

  /** Swings the camera to the wheel and spins it so number `result` stops under the pointer. */
  async spin(result: number): Promise<void> {
    if (this.stage.director.cinematic) {
      this.stage.director.wheel();
      await this.stage.wait(0.7);
    }
    const wedge = (Math.PI * 2) / 10;
    // Land somewhere inside the wedge, not always dead centre.
    const phi = (result - 1 + 0.5) * wedge + (Math.random() - 0.5) * wedge * 0.6;
    const base = phi - Math.PI / 2;
    const from = this.disc.rotation.y;
    const delta = (((base - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const to = from + delta + Math.PI * 2 * 4; // four full turns first
    let lastWedge = Math.floor(from / wedge);
    await this.stage.tween(2.4, (k) => {
      this.disc.rotation.y = from + (to - from) * easeOutCubic(k);
      // A tick every time a wedge passes the pointer, slowing down with the wheel.
      const current = Math.floor(this.disc.rotation.y / wedge);
      if (current !== lastWedge) sound.play('tick');
      lastWedge = current;
    });
    sound.play('wheelStop');
    await this.stage.wait(0.35);
  }

  /** Per-frame animation: the glow ring pulses while armed. */
  update(time: number): void {
    if (!this.glow.visible) return;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 5) * 0.35;
    const s = 1 + Math.sin(time * 5) * 0.015;
    this.glow.scale.set(s, s, s);
  }
}
