import * as THREE from 'three';
import { sound } from '../../audio';
import { BOARD_SIZE } from '../../core/rules';
import type { PartyDef } from '../../core/types';
import { settings } from '../../core/settings';
import { easeInOut, easeOutCubic } from '../animation';
import type { PawnShot } from '../CameraDirector';
import { RING_R } from '../layout';
import { makePawn } from '../models';
import type { Stage } from '../Stage';
import { floatTexture } from '../textures/cards';
import type { Track } from './Track';

/** The party pawns on the track: moving, riding the escalator, cheering, and the marker under the active one. */
export class Pawns {
  private readonly pawns = new Map<number, THREE.Group>();
  /** Height each pawn rests at on its current square. */
  private readonly restY = new Map<number, number>();
  /** How many popularity numbers are floating above each pawn (so they stack instead of overlapping). */
  private readonly floating = new Map<number, number>();
  /** Glowing ring under the pawn whose turn it is. */
  private readonly marker: THREE.Mesh;
  private activeId = -1;

  constructor(
    private readonly stage: Stage,
    private readonly track: Track,
  ) {
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.07, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9 }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    stage.scene.add(this.marker);
  }

  /** Puts every party's pawn on the Election square (square 0), where the game starts. */
  place(players: { id: number; party: PartyDef }[]): void {
    for (const p of players) {
      const pawn = makePawn(p.party);
      pawn.position.copy(this.track.spot(0, p.id));
      this.restY.set(p.id, pawn.position.y);
      this.pawns.set(p.id, pawn);
      this.stage.scene.add(pawn);
    }
  }

  get(id: number): THREE.Group | undefined {
    return this.pawns.get(id);
  }

  all(): THREE.Group[] {
    return [...this.pawns.values()];
  }

  /** Shows the marker under player `id` (−1 hides it). */
  setActive(id: number): void {
    this.activeId = id;
    this.marker.visible = id >= 0;
  }

  hideMarker(): void {
    this.marker.visible = false;
  }

  /** Points the camera at a pawn. */
  focus(id: number, kind: PawnShot): void {
    const pawn = this.pawns.get(id);
    if (pawn) this.stage.director.followFromOutside(pawn, kind);
  }

  /** Hops a pawn `steps` squares forward, one square at a time; from square 0 it rides the escalator down. */
  async move(id: number, from: number, steps: number): Promise<void> {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    this.focus(id, 'follow');
    await this.stage.wait(0.45);
    for (let s = 1; s <= steps; s++) {
      const a = this.track.spot((from + s - 1) % BOARD_SIZE, id);
      const b = this.track.spot((from + s) % BOARD_SIZE, id);
      if ((from + s - 1) % BOARD_SIZE === 0) {
        await this.rideEscalator(pawn, a, b); // a new year: down from the summit
        continue;
      }
      sound.play('hop');
      await this.stage.tween(0.26, (k) => {
        const e = easeInOut(k);
        pawn.position.lerpVectors(a, b, e);
        pawn.position.y = a.y + (b.y - a.y) * e + Math.sin(k * Math.PI) * 0.9;
      });
    }
    this.restY.set(id, pawn.position.y);
    this.focus(id, 'close');
  }

  /** A pawn steps onto the escalator at the Election square, rides it down and steps off onto the Cabinet square. */
  private async rideEscalator(pawn: THREE.Group, from: THREE.Vector3, to: THREE.Vector3): Promise<void> {
    const escalator = this.track.escalator;
    const hop = (a: THREE.Vector3, b: THREE.Vector3) => {
      sound.play('hop');
      return this.stage.tween(0.4, (k) => {
        const e = easeInOut(k);
        pawn.position.lerpVectors(a, b, e);
        pawn.position.y = a.y + (b.y - a.y) * e + Math.sin(k * Math.PI) * 0.6;
      });
    };
    // The treads are as wide as a square, so each pawn keeps its own lane across them.
    const lane = Math.hypot(from.x, from.z) - RING_R;
    const s0 = escalator.boardS;
    const s1 = escalator.alightS;
    await hop(from, escalator.pointAt(s0, lane));
    // The stairs start moving to carry the pawn down (standing on a tread), and stop once it is off.
    const rideSpeed = 1.6;
    escalator.speed = rideSpeed * settings.speed;
    sound.play('escalator', (s1 - s0) / rideSpeed / settings.speed); // the hum lasts the whole ride, in real seconds
    await this.stage.tween((s1 - s0) / rideSpeed, (k) => {
      pawn.position.copy(escalator.pointAt(s0 + (s1 - s0) * k, lane));
      pawn.rotation.z = Math.sin(k * Math.PI * 5) * 0.05;
    });
    escalator.speed = 0;
    pawn.rotation.z = 0;
    await hop(escalator.pointAt(s1, lane), to);
  }

  /** A floating "+5" / "−3" above a pawn, rising and fading. */
  floatText(id: number, text: string, color: number): void {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    const stack = this.floating.get(id) ?? 0;
    this.floating.set(id, stack + 1);
    const texture = floatTexture(text, color);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4, 0.9, 1);
    sprite.renderOrder = 10;
    const start = pawn.position.clone().add(new THREE.Vector3(0, 2.6 + stack * 0.9, 0));
    sprite.position.copy(start);
    this.stage.scene.add(sprite);
    void this.stage
      .tween(2.2, (k) => {
        sprite.position.set(start.x, start.y + easeOutCubic(k) * 1.6, start.z);
        material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      })
      .then(() => {
        this.stage.scene.remove(sprite);
        texture.dispose();
        material.dispose();
        this.floating.set(id, Math.max(0, (this.floating.get(id) ?? 1) - 1));
      });
  }

  /**
   * One frame of a vote reaction (k from 0 to 1, `fade` from 1 to 0 at the end): the winners' pawns jump,
   * the losers' shake their heads. `reset()` puts them back.
   */
  react(k: number, fade: number, happy: Set<number>, sad: Set<number>): void {
    for (const [id, pawn] of this.pawns) {
      if (happy.has(id)) pawn.position.y = (this.restY.get(id) ?? 0) + Math.abs(Math.sin(k * Math.PI * 6)) * 0.7 * fade;
      pawn.rotation.z = sad.has(id) ? Math.sin(k * Math.PI * 10) * 0.3 * fade : 0;
    }
  }

  resetPoses(): void {
    for (const [id, pawn] of this.pawns) {
      pawn.rotation.z = 0;
      pawn.position.y = this.restY.get(id) ?? 0;
    }
  }

  /** Per-frame animation: the marker follows and pulses under the active pawn. */
  update(time: number): void {
    const pawn = this.pawns.get(this.activeId);
    if (!pawn || !this.marker.visible) return;
    this.marker.position.set(pawn.position.x, pawn.position.y + 0.08, pawn.position.z);
    const s = 1 + Math.sin(time * 4) * 0.12;
    this.marker.scale.set(s, s, s);
  }
}
