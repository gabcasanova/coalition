import * as THREE from 'three';
import { sound } from '../../audio';
import { animationSpeed } from '../../core/settings';
import type { PartyDef } from '../../core/types';
import { easeInOut } from '../animation';
import { LEADER_SCALE } from '../layout';
import { makeLeader } from '../models';
import type { Stage } from '../Stage';

/**
 * The President: a throne at the far end of the red carpet, between the government and the opposition. A new
 * President arrives by helicopter, climbs down a rope ladder onto the carpet, walks up to the throne and sits.
 *
 * Everything here lives in the aisle's own frame (the carpet runs along +x from the middle of the chamber), so the
 * throne and whoever sits on it slide along with the carpet when the benches reshuffle.
 */

/** Where the throne stands along the carpet, and the height of its seat. */
const THRONE_X = 16.1;
const SEAT_Y = 0.98;
/** Where the helicopter hovers (over the carpet, in front of the throne) and the height of its door. */
const HOVER = new THREE.Vector3(12.6, 6.4, 0);
const DOOR_DROP = 0.75;
/** Size of the helicopter model (its parts are built at 1). */
const HELI_SCALE = 0.75;
/** Height of a figure's origin above what it stands on. */
const LIFT = 0.3 * LEADER_SCALE;

export class Presidency {
  private readonly throne = new THREE.Group();
  private seated: { id: number; figure: THREE.Group } | null = null;
  /** True while a new President is on the way (their party already holds the office). */
  private arriving = false;
  /** Bumped whenever the presidency changes hands, so an outdated arrival stops. */
  private generation = 0;

  constructor(
    private readonly stage: Stage,
    /** The red carpet's group (see Chamber): +x runs along the carpet, away from the middle. */
    private readonly aisle: THREE.Group,
  ) {
    this.buildThrone();
    this.aisle.add(this.throne);
  }

  /** A gilded throne on a red-and-gold platform, facing down the carpet toward the middle of the chamber. */
  private buildThrone(): void {
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9ad3c, metalness: 0.9, roughness: 0.25 });
    const velvet = new THREE.MeshStandardMaterial({ color: 0x8c1426, roughness: 0.7 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x2c2430, roughness: 0.8 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.throne.add(mesh);
      return mesh;
    };
    // Two-step platform with gold edges.
    add(new THREE.BoxGeometry(2.6, 0.2, 2.6), stone, THRONE_X, 0.1);
    add(new THREE.BoxGeometry(2.62, 0.04, 2.62), gold, THRONE_X, 0.21);
    add(new THREE.BoxGeometry(1.9, 0.18, 2.0), velvet, THRONE_X + 0.2, 0.32);
    // Seat, cushion and a tall back with a gold frame.
    add(new THREE.BoxGeometry(1.1, 0.42, 1.25), gold, THRONE_X + 0.2, 0.62);
    add(new THREE.BoxGeometry(1.0, 0.12, 1.12), velvet, THRONE_X + 0.15, 0.9);
    add(new THREE.BoxGeometry(0.22, 2.5, 1.35), gold, THRONE_X + 0.75, 1.95);
    add(new THREE.BoxGeometry(0.1, 2.2, 1.05), velvet, THRONE_X + 0.62, 1.95);
    // Arms ending in gold balls.
    for (const z of [-0.66, 0.66]) {
      add(new THREE.BoxGeometry(1.05, 0.14, 0.16), gold, THRONE_X + 0.15, 1.28, z);
      add(new THREE.SphereGeometry(0.11, 12, 10), gold, THRONE_X - 0.38, 1.3, z);
    }
    // A crown on top of the back: a band with five points.
    add(new THREE.CylinderGeometry(0.42, 0.38, 0.22, 20, 1, true), gold, THRONE_X + 0.75, 3.35);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.08, 0.26, 8), gold, THRONE_X + 0.75 + Math.cos(a) * 0.4, 3.57, Math.sin(a) * 0.4);
    }
    add(new THREE.SphereGeometry(0.1, 12, 10), velvet, THRONE_X + 0.75, 3.42);
  }

  /** The figure's spot on the throne (in the aisle's frame). */
  private seatSpot(): THREE.Vector3 {
    return new THREE.Vector3(THRONE_X + 0.15, SEAT_Y + LIFT, 0);
  }

  /** Seats a figure on the throne, facing down the carpet. */
  private sitDown(figure: THREE.Object3D): void {
    figure.position.copy(this.seatSpot());
    figure.rotation.set(0, -Math.PI / 2, 0);
  }

  /** The President's figure: a leader with a gold sash across the chest. */
  private makePresident(party: PartyDef): THREE.Group {
    const figure = makeLeader(party);
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.65;
    tilt.position.y = -0.2;
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.05, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.5, roughness: 0.35 }),
    );
    sash.rotation.x = Math.PI / 2;
    tilt.add(sash);
    figure.add(tilt);
    return figure;
  }

  /**
   * Keeps the throne in step with the game: whoever sits there leaves if their party no longer holds the
   * presidency (a new President arrives through `arrive`).
   */
  update(players: { id: number; isPresident: boolean }[]): void {
    const president = players.find((p) => p.isPresident);
    if (this.seated && this.seated.id !== president?.id && !this.arriving) this.remove();
  }

  /** The current President leaves (their figure shrinks away). */
  remove(): void {
    const current = this.seated;
    if (!current) return;
    this.seated = null;
    this.generation++;
    const figure = current.figure;
    void this.stage
      .tween(0.5, (k) => figure.scale.setScalar(Math.max(0.001, 1 - k)))
      .then(() => figure.parent?.remove(figure));
  }

  /** Seats a President at once, without the helicopter. */
  place(player: { id: number; party: PartyDef }): void {
    this.remove();
    const figure = this.makePresident(player.party);
    this.sitDown(figure);
    this.aisle.add(figure);
    this.seated = { id: player.id, figure };
  }

  /**
   * A new President arrives: the helicopter flies in over the chamber and hovers above the carpet, a rope ladder
   * unrolls, the President climbs down, the helicopter flies off, and the President walks up the carpet and
   * takes the throne. With `camera`, the cinematic camera follows.
   */
  async arrive(player: { id: number; party: PartyDef }, camera: boolean): Promise<void> {
    this.arriving = true;
    try {
      await this.flyIn(player, camera);
    } finally {
      this.arriving = false;
    }
  }

  private async flyIn(player: { id: number; party: PartyDef }, camera: boolean): Promise<void> {
    const { stage } = this;
    if (this.seated?.id === player.id) return;
    this.remove();
    const generation = ++this.generation;
    const alive = () => generation === this.generation;

    const heli = buildHelicopter();
    // Long enough to reach the carpet (the ladder hangs inside the scaled helicopter).
    const ladder = buildLadder((HOVER.y - DOOR_DROP * HELI_SCALE) / HELI_SCALE);
    ladder.position.set(0.2, -DOOR_DROP, 0.75); // hanging from the door on the helicopter's right side
    ladder.scale.y = 0.001;
    heli.group.add(ladder);
    const from = new THREE.Vector3(34, 17, -14);
    const away = new THREE.Vector3(30, 19, 16);
    heli.group.position.copy(from);
    this.aisle.add(heli.group);

    // Rotors spin for as long as the helicopter is around.
    let flying = true;
    const spin = () => {
      const t = stage.director.time;
      heli.rotor.rotation.y = t * 32;
      heli.tailRotor.rotation.z = t * 45;
    };
    void (async () => {
      while (flying) await stage.tween(0.5, spin);
    })();

    // The camera watches from the front of the carpet: first the helicopter, then the President.
    const world = (v: THREE.Vector3) => this.aisle.localToWorld(v.clone());
    let focus = () => heli.group.position;
    if (camera && stage.director.cinematic) {
      stage.director.frame(() => ({
        pos: world(new THREE.Vector3(4.5, 7.5, 7.5)),
        target: world(
          focus()
            .clone()
            .lerp(new THREE.Vector3(THRONE_X, 1.2, 0), 0.5),
        ),
        rate: 2,
      }));
    }

    // Fly in, banking into the turn, and settle into a hover. (The rotor sound lasts the whole visit.)
    sound.play('helicopter', 7.6 / animationSpeed());
    await stage.tween(2.4, (k) => {
      const e = easeInOut(k);
      heli.group.position.lerpVectors(from, HOVER, e);
      heli.group.position.y += Math.sin(k * Math.PI) * 1.5;
      heli.group.rotation.set(Math.sin(k * Math.PI) * 0.18, Math.PI + (1 - e) * 0.9, -Math.sin(k * Math.PI) * 0.12);
    });
    if (!alive()) return this.cleanUp(heli.group, () => (flying = false));
    heli.group.rotation.set(0, Math.PI, 0);

    // The ladder unrolls.
    await stage.tween(0.6, (k) => {
      ladder.scale.y = Math.max(0.001, easeInOut(k));
      heli.group.position.y = HOVER.y + Math.sin(k * Math.PI * 2) * 0.06;
    });

    // The President appears at the door and climbs down.
    const figure = this.makePresident(player.party);
    const door = heli.group.localToWorld(new THREE.Vector3(0.2, -DOOR_DROP + LIFT * 0.4, 0.75));
    const doorLocal = this.aisle.worldToLocal(door);
    const foot = new THREE.Vector3(doorLocal.x, LIFT, doorLocal.z);
    figure.position.copy(doorLocal);
    figure.rotation.set(0, 0, 0);
    figure.scale.setScalar(0.001);
    this.aisle.add(figure);
    this.seated = { id: player.id, figure };
    focus = () => figure.position;
    await stage.tween(0.3, (k) => figure.scale.setScalar(Math.max(0.001, k)));
    await stage.tween(1.7, (k) => {
      if (!alive()) return;
      // Rung by rung: little steps down, swaying on the rope.
      const rung = Math.floor(k * 9) + easeInOut((k * 9) % 1);
      figure.position.lerpVectors(doorLocal, foot, rung / 9);
      figure.rotation.z = Math.sin(k * Math.PI * 9) * 0.06;
    });
    if (!alive()) return this.cleanUp(heli.group, () => (flying = false));
    figure.rotation.z = 0;

    // The ladder rolls up and the helicopter leaves while the President walks up the carpet.
    const leaving = (async () => {
      await stage.tween(0.4, (k) => (ladder.scale.y = Math.max(0.001, 1 - k)));
      await stage.tween(2.2, (k) => {
        const e = easeInOut(k);
        heli.group.position.lerpVectors(HOVER, away, e);
        heli.group.position.y += e * 2;
        heli.group.rotation.set(-Math.sin(k * Math.PI) * 0.2, Math.PI - e * 0.8, 0);
      });
      this.cleanUp(heli.group, () => (flying = false));
    })();

    const start = foot.clone();
    const front = new THREE.Vector3(THRONE_X - 1.25, LIFT + 0.2, 0);
    figure.rotation.y = Math.atan2(front.x - start.x, front.z - start.z);
    await stage.tween(1.6, (k) => {
      if (!alive()) return;
      figure.position.lerpVectors(start, front, easeInOut(k));
      figure.position.y += Math.abs(Math.sin(k * Math.PI * 5)) * 0.16;
      figure.rotation.z = Math.sin(k * Math.PI * 5) * 0.07;
    });
    if (!alive()) return;
    figure.rotation.z = 0;

    // Up onto the throne, turning round to face the chamber.
    const seat = this.seatSpot();
    const turnFrom = figure.rotation.y;
    const turnTo = -Math.PI / 2;
    const turn = Math.atan2(Math.sin(turnTo - turnFrom), Math.cos(turnTo - turnFrom));
    await stage.tween(0.7, (k) => {
      const e = easeInOut(k);
      figure.position.lerpVectors(front, seat, e);
      figure.position.y += Math.sin(k * Math.PI) * 0.6;
      figure.rotation.y = turnFrom + turn * e;
    });
    if (alive()) this.sitDown(figure);
    await leaving;
  }

  private cleanUp(heli: THREE.Object3D, stop: () => void): void {
    stop();
    heli.parent?.remove(heli);
  }
}

/** A small helicopter, nose along +z: body, cockpit glass, tail boom with a fin and a tail rotor, skids, rotor. */
function buildHelicopter(): { group: THREE.Group; rotor: THREE.Group; tailRotor: THREE.Group } {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x2f5fb3, metalness: 0.35, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 0.2, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x7fb4e6, metalness: 0.6, roughness: 0.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.8, roughness: 0.3 });
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = add(group, new THREE.SphereGeometry(1, 24, 16), paint);
  body.scale.set(1.05, 0.95, 1.9);
  const top = add(group, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  top.scale.set(1.0, 0.75, 1.75);
  top.position.y = 0.12;
  const cockpit = add(group, new THREE.SphereGeometry(0.75, 20, 14), glass);
  cockpit.scale.set(1, 0.8, 0.9);
  cockpit.position.set(0, 0.15, 1.35);
  const boom = add(group, new THREE.CylinderGeometry(0.16, 0.3, 3.6, 12), paint);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.25, -3.1);
  const fin = add(group, new THREE.BoxGeometry(0.1, 1.0, 0.6), paint);
  fin.position.set(0, 0.7, -4.75);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.15, 0.75, -4.8);
  for (let i = 0; i < 2; i++) {
    const blade = add(tailRotor, new THREE.BoxGeometry(0.04, 1.1, 0.12), steel);
    blade.rotation.x = (i * Math.PI) / 2;
  }
  group.add(tailRotor);
  for (const x of [-0.75, 0.75]) {
    const skid = add(group, new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), steel);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(x, -1.15, 0);
    for (const z of [-0.8, 0.8]) {
      const strut = add(group, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), steel);
      strut.position.set(x * 0.85, -0.9, z);
    }
  }
  const rotor = new THREE.Group();
  rotor.position.y = 1.15;
  add(rotor, new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), steel);
  for (let i = 0; i < 4; i++) {
    const blade = add(rotor, new THREE.BoxGeometry(5.2, 0.04, 0.26), steel);
    blade.rotation.y = (i * Math.PI) / 4;
    blade.position.y = 0.15;
  }
  group.add(rotor);
  group.scale.setScalar(HELI_SCALE);
  return { group, rotor, tailRotor };
}

/** A rope ladder `length` long, hanging down from its origin (scale y to unroll it). */
function buildLadder(length: number): THREE.Group {
  const ladder = new THREE.Group();
  const rope = new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.9 });
  for (const z of [-0.28, 0.28]) {
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 6), rope);
    side.position.set(0, -length / 2, z);
    ladder.add(side);
  }
  for (let y = 0.35; y < length; y += 0.42) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.56, 6), rope);
    rung.rotation.x = Math.PI / 2;
    rung.position.y = -y;
    ladder.add(rung);
  }
  return ladder;
}
