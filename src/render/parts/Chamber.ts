import * as THREE from 'three';
import { THEME } from '../../assets/theme';
import { sound } from '../../audio';
import { animationSpeed } from '../../core/settings';
import { benchOrder, TOTAL_SEATS } from '../../core/rules';
import type { Player } from '../../core/types';
import { L } from '../../i18n';
import { easeInOut, easeOutBack } from '../animation';
import { AISLE_GAP, CROSSBENCH_GAP, END_GAP, ROW_HEIGHTS, ROW_RADII } from '../layout';
import { mpGeometry } from '../models';
import type { Stage } from '../Stage';
import { titleTexture } from '../textures/board';

/** Seconds the MPs take to walk to new benches when the seats change. */
export const RESEAT_SECONDS = 1.3;

/** Where the chamber's blocks are after a re-seating (chamber angles; a block is missing if it has no seats). */
export interface ChamberLayout {
  aisleAngle: number;
  hasAisle: boolean;
  /** Centre angle of each block. */
  centres: Partial<Record<BlockKind, number>>;
}
type BlockKind = 'opposition' | 'independents' | 'government';
/** How far the MP model's origin sits above its feet (see mpGeometry). */
const MP_FEET = 0.3;

/**
 * The parliament hemicycle: 7 tiered rows of benches split into three blocks: the opposition on the left, the
 * independents' crossbench in the middle and the government on the right, with a red carpet (the aisle) between
 * the government and the rest. Each of the 150 MPs is one instance of
 * an InstancedMesh, coloured by party. An empty seat has no MP: its instance shrinks away, and grows back out of
 * the bench when a party wins the seat.
 */
export class Chamber {
  /** Chamber angle of the aisle between the government and the rest. */
  aisleAngle = Math.PI / 2;
  /** Centre angle of each block of benches. */
  private blockCentres: ChamberLayout['centres'] = {};
  private readonly benches = new THREE.Group();
  private readonly benchMaterial = new THREE.MeshStandardMaterial({ color: THEME.benches, roughness: 0.8 });
  private readonly crossbenchMaterial = new THREE.MeshStandardMaterial({ color: THEME.crossbenches, roughness: 0.8 });
  /** The red carpet (and the President's throne on it); +x runs along the carpet, away from the middle. */
  readonly aisle = new THREE.Group();
  private readonly seats: THREE.InstancedMesh;
  /**
   * Per MP (instance): where it is, its colour, its size (0 = no MP), which player it belongs to (−1 = nobody),
   * whether it is a government MP, and its place in the left-to-right seating order.
   */
  private seatPos: THREE.Vector3[] = [];
  private readonly seatColors: THREE.Color[] = [];
  private readonly seatSize: number[] = [];
  private seatOwner: number[] = [];
  private seatGov: boolean[] = [];
  private seatSlot: number[] = [];
  /** Bumped on every re-seating, so an older re-seating animation stops if a newer one starts. */
  private reseatGeneration = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly tilt = new THREE.Matrix4();

  constructor(private readonly stage: Stage) {
    stage.scene.add(this.benches);

    // The aisle: a red carpet with glowing gold edges, rotated to sit between the two blocks.
    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 0.05, 1.5),
      new THREE.MeshStandardMaterial({ color: THEME.carpet, roughness: 0.9 }),
    );
    carpet.position.set(12.5, 0.08, 0);
    carpet.receiveShadow = true;
    this.aisle.add(carpet);
    const edge = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: 1.2 });
    for (const z of [-0.8, 0.8]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.08, 0.08), edge);
      strip.position.set(12.5, 0.12, z);
      this.aisle.add(strip);
    }
    this.aisle.visible = false;
    stage.scene.add(this.aisle);

    // 150 MPs, all hidden until parties win their seats.
    this.seats = new THREE.InstancedMesh(
      mpGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.15 }),
      TOTAL_SEATS,
    );
    this.seats.castShadow = true;
    const grey = new THREE.Color(THEME.emptySeat);
    this.seatPos = this.layout(0, 0);
    this.seatPos.forEach((_, i) => {
      this.seats.setColorAt(i, grey);
      this.seatColors.push(grey.clone());
      this.seatSize.push(0);
      this.seatOwner.push(-1);
      this.seatGov.push(false);
      this.seatSlot.push(i);
      this.setSeat(i);
    });
    stage.scene.add(this.seats);

    // "PARLIAMENT" painted on the floor in front of the benches.
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({
        map: titleTexture(
          L('PARLIAMENT', 'PARLAMENTO'),
          L('150 seats · 76 for a majority', '150 cadeiras · 76 para a maioria'),
        ),
        transparent: true,
        depthWrite: false,
      }),
    );
    title.rotation.x = -Math.PI / 2;
    title.position.set(0, 0.08, -7.1);
    title.scale.setScalar(0.5);
    stage.scene.add(title);
  }

  /**
   * Seat positions for a chamber split into blocks, left to right: the opposition, the independents' crossbench
   * (which also holds any seats nobody has won yet) and the government. Each block's width follows its seat
   * count; the red carpet runs between the government and the rest, a plain gap between the opposition and the
   * crossbench. Rebuilds the bench tiers to match, updates `aisleAngle`, and returns the positions left to right.
   */
  private layout(oppositionSeats: number, governmentSeats: number): THREE.Vector3[] {
    const present = [
      { kind: 'opposition' as const, n: oppositionSeats, material: this.benchMaterial, government: false },
      {
        kind: 'independents' as const,
        n: TOTAL_SEATS - oppositionSeats - governmentSeats,
        // Before there is a government every party sits together, on ordinary benches.
        material: governmentSeats > 0 ? this.crossbenchMaterial : this.benchMaterial,
        government: false,
      },
      { kind: 'government' as const, n: governmentSeats, material: this.benchMaterial, government: true },
    ].filter((b) => b.n > 0);
    const gapBefore = present.map((b, k): number => (k === 0 ? 0 : b.government ? AISLE_GAP : CROSSBENCH_GAP));
    // The benches span [END_GAP, π − END_GAP]; the free ends hold the leaders' daises.
    const usable = Math.PI - 2 * END_GAP - gapBefore.reduce((a, b) => a + b, 0);
    this.aisleAngle = Math.PI / 2;
    let angle = Math.PI - END_GAP;
    const blocks = present.map((b, k) => {
      angle -= gapBefore[k];
      if (b.government && k > 0) this.aisleAngle = angle + AISLE_GAP / 2;
      const from = angle;
      angle -= (b.n / TOTAL_SEATS) * usable;
      return { ...b, from, to: angle };
    });
    this.blockCentres = Object.fromEntries(blocks.map((b) => [b.kind, (b.from + b.to) / 2]));

    for (const child of [...this.benches.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.benches.remove(child);
    }

    const positions: THREE.Vector3[] = [];
    for (const block of blocks) {
      if (block.n <= 0) continue;
      const span = block.from - block.to;
      // Longer (outer) rows get more seats.
      const totalLength = ROW_RADII.reduce((acc, r) => acc + r, 0);
      const perRow = ROW_RADII.map((r) => Math.floor((block.n * r) / totalLength));
      let left = block.n - perRow.reduce((acc, x) => acc + x, 0);
      for (let i = perRow.length - 1; left > 0; i = (i - 1 + perRow.length) % perRow.length, left--) perRow[i]++;

      const seats: { pos: THREE.Vector3; phi: number; row: number }[] = [];
      ROW_RADII.forEach((r, row) => {
        const n = perRow[row];
        for (let j = 0; j < n; j++) {
          const phi = block.from - ((j + 0.5) / n) * span;
          seats.push({
            pos: new THREE.Vector3(r * Math.cos(phi), ROW_HEIGHTS[row] + 0.3, -r * Math.sin(phi)),
            phi,
            row,
          });
        }
        // The bench tier for this row: an arc-shaped slab.
        const shape = new THREE.Shape();
        shape.absarc(0, 0, r + 0.65, block.to, block.from, false);
        shape.absarc(0, 0, r - 0.65, block.from, block.to, true);
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: ROW_HEIGHTS[row],
          bevelEnabled: false,
          curveSegments: 32,
        });
        geometry.rotateX(-Math.PI / 2);
        const tier = new THREE.Mesh(geometry, block.material);
        tier.receiveShadow = true;
        tier.castShadow = true;
        this.benches.add(tier);
      });
      seats.sort((a, b) => b.phi - a.phi || a.row - b.row);
      positions.push(...seats.map((s) => s.pos));
    }
    return positions;
  }

  /**
   * Re-seats parliament for the current players: each party takes a stretch of benches (opposition left,
   * independents, government right) over RESEAT_SECONDS. MPs keep their party where they can and glide to its new
   * benches; a party's new MPs grow out of their seats and lost ones shrink away. Returns where the aisle ends up.
   */
  update(players: Player[]): ChamberLayout {
    const order = benchOrder(players);
    const governmentSeats = players.filter((p) => p.inGov).reduce((acc, p) => acc + p.seats, 0);
    const oppositionSeats = players.filter((p) => p.inOpp).reduce((acc, p) => acc + p.seats, 0);
    const slotPos = this.layout(oppositionSeats, governmentSeats);

    // The seats each party takes, left to right.
    const slotsOf = new Map<number, number[]>();
    let next = 0;
    for (const p of order) {
      const slots: number[] = [];
      for (let j = 0; j < p.seats && next < TOTAL_SEATS; j++) slots.push(next++);
      slotsOf.set(p.id, slots);
    }

    // Each party keeps as many of its current MPs as it still has seats (matched in seating order); the rest
    // leave. Seats still needed are filled by hidden instances (which grow in place) or, failing that, by MPs
    // another party lost (who cross over and change colour).
    const target = new Array<number>(TOTAL_SEATS).fill(-1); // instance → slot (−1: no seat)
    const byOrder = (a: number, b: number) => this.seatSlot[a] - this.seatSlot[b];
    const needed: number[] = [];
    const used = new Set<number>();
    for (const [id, slots] of slotsOf) {
      const mine = this.seatOwner
        .map((owner, i) => (owner === id && this.seatSize[i] > 0 ? i : -1))
        .filter((i) => i >= 0)
        .sort(byOrder);
      slots.forEach((slot, j) => {
        if (j < mine.length) {
          target[mine[j]] = slot;
          used.add(mine[j]);
        } else needed.push(slot);
      });
    }
    const hidden = [...Array(TOTAL_SEATS).keys()].filter((i) => !used.has(i) && this.seatSize[i] === 0);
    const leaving = [...Array(TOTAL_SEATS).keys()].filter((i) => !used.has(i) && this.seatSize[i] > 0).sort(byOrder);
    for (const slot of needed) {
      const i = hidden.length ? hidden.pop()! : leaving.shift()!;
      target[i] = slot;
    }

    const slotOwner: number[] = [];
    const slotGov: boolean[] = [];
    const slotColor: THREE.Color[] = [];
    for (const p of order) {
      for (const slot of slotsOf.get(p.id)!) {
        slotOwner[slot] = p.id;
        slotGov[slot] = p.inGov;
        slotColor[slot] = new THREE.Color(p.party.color);
      }
    }

    const hasAisle = governmentSeats > 0 && governmentSeats < TOTAL_SEATS;
    const fromAngle = this.aisle.visible ? this.aisle.rotation.y : this.aisleAngle;
    const toAngle = this.aisleAngle;
    this.aisle.visible = hasAisle;

    const fromPos = this.seatPos.map((v) => v.clone());
    const toPos = fromPos.map((p, i) => (target[i] >= 0 ? slotPos[target[i]] : p));
    const fromColors = this.seatColors.map((c) => c.clone());
    const toColors = fromColors.map((c, i) => (target[i] >= 0 ? slotColor[target[i]] : c));
    const fromSize = [...this.seatSize];
    const toSize = target.map((slot) => (slot >= 0 ? 1 : 0));
    // MPs who appear grow in place one after another, left to right; nobody slides in from a hidden spot.
    const growing = target
      .map((slot, i) => (slot >= 0 && fromSize[i] === 0 ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => target[a] - target[b]);
    const growRank = new Map(growing.map((i, j) => [i, growing.length > 1 ? j / (growing.length - 1) : 0]));
    for (const i of growing) {
      fromPos[i].copy(toPos[i]);
      fromColors[i].copy(toColors[i]);
    }
    for (let i = 0; i < TOTAL_SEATS; i++) {
      this.seatOwner[i] = target[i] >= 0 ? slotOwner[target[i]] : -1;
      this.seatGov[i] = target[i] >= 0 ? slotGov[target[i]] : false;
      if (target[i] >= 0) this.seatSlot[i] = target[i];
    }

    const generation = ++this.reseatGeneration;
    void this.stage.tween(RESEAT_SECONDS, (k) => {
      if (generation !== this.reseatGeneration) return; // a newer re-seating took over
      const e = easeInOut(k);
      for (let i = 0; i < TOTAL_SEATS; i++) {
        const rank = growRank.get(i);
        if (rank !== undefined) {
          this.seatSize[i] = Math.max(0, easeOutBack(THREE.MathUtils.clamp(k * 1.8 - rank * 0.8, 0, 1)));
        } else {
          this.seatSize[i] = fromSize[i] + (toSize[i] - fromSize[i]) * e;
        }
        this.seatPos[i].lerpVectors(fromPos[i], toPos[i], e);
        const moving = rank === undefined && toSize[i] > 0 && fromPos[i].distanceToSquared(toPos[i]) > 1e-4;
        this.setSeat(i, moving ? Math.sin(k * Math.PI) * 0.8 : 0); // a little hop on the way
        this.seatColors[i].copy(fromColors[i]).lerp(toColors[i], e);
        this.seats.setColorAt(i, this.seatColors[i]);
      }
      this.seats.instanceMatrix.needsUpdate = true;
      this.seats.instanceColor!.needsUpdate = true;
      this.aisle.rotation.y = fromAngle + (toAngle - fromAngle) * e;
    });
    return { aisleAngle: this.aisleAngle, hasAisle, centres: this.blockCentres };
  }

  /**
   * Writes one MP's matrix: its bench position, its size (growing from its feet), a lift for government MPs, plus
   * an optional hop and sideways tilt.
   */
  private setSeat(i: number, hop = 0, tilt = 0): void {
    const p = this.seatPos[i];
    const government = this.seatGov[i];
    const size = Math.max(this.seatSize[i], 1e-3);
    // The model's origin is MP_FEET above its feet: keep the feet on the bench while it scales.
    this.matrix.makeTranslation(p.x, p.y + hop + (government ? 0.18 : 0) - MP_FEET * (1 - size), p.z);
    if (tilt) this.matrix.multiply(this.tilt.makeRotationZ(tilt));
    if (government) this.matrix.multiply(this.tilt.makeScale(1.1, 1.25, 1.1));
    this.matrix.multiply(this.tilt.makeScale(size, size, size));
    this.seats.setMatrixAt(i, this.matrix);
  }

  /** Puts every MP back in its seat, standing still. */
  resetPoses(): void {
    for (let i = 0; i < TOTAL_SEATS; i++) this.setSeat(i);
    this.seats.instanceMatrix.needsUpdate = true;
  }

  /** One frame of a vote reaction: the winners' MPs jump for joy, the losers' shake their heads. */
  react(k: number, fade: number, happy: Set<number>, sad: Set<number>): void {
    for (let i = 0; i < TOTAL_SEATS; i++) {
      const who = this.seatOwner[i];
      if (happy.has(who)) this.setSeat(i, Math.abs(Math.sin(k * Math.PI * 7 + i * 0.4)) * 0.55 * fade);
      else if (sad.has(who)) this.setSeat(i, -0.04 * fade, Math.sin(k * Math.PI * 12 + i * 0.3) * 0.32 * fade);
      else this.setSeat(i);
    }
    this.seats.instanceMatrix.needsUpdate = true;
  }

  /** The opposition rises in a wave, from the aisle out to the end of the chamber, over `seconds`. */
  async oppositionWave(memberIds: number[], seconds: number): Promise<void> {
    const members = new Set(memberIds);
    await this.stage.tween(seconds, (k) => {
      const fade = 1 - Math.max(0, (k - 0.85) / 0.15);
      for (let i = 0; i < TOTAL_SEATS; i++) {
        if (!members.has(this.seatOwner[i])) continue;
        const p = this.seatPos[i];
        const phi = Math.atan2(-p.z, p.x);
        const along = (phi - this.aisleAngle) / Math.max(0.01, Math.PI - this.aisleAngle);
        const wave = THREE.MathUtils.clamp(k * 1.6 - along * 0.6, 0, 1);
        this.setSeat(i, Math.sin(wave * Math.PI) * 0.6 * fade);
      }
      this.seats.instanceMatrix.needsUpdate = true;
    });
    this.resetPoses();
  }

  /**
   * Floor crossing: `n` MPs of one party leave their benches, walk across the aisle and join another party's
   * benches, changing colour on the way. (The full re-seating follows when the engine reports the new seats.)
   */
  async floorCross(fromId: number, toId: number, n: number, toColor: number): Promise<void> {
    const mine = this.seatsOf(fromId);
    const theirs = this.seatsOf(toId);
    const movers = mine.slice(-n);
    if (!movers.length) return;
    // Destination: around the middle of the receiving party's benches.
    const centre = new THREE.Vector3();
    for (const i of theirs.length ? theirs : movers) centre.add(this.seatPos[i]);
    centre.divideScalar(theirs.length || movers.length);
    const aisle = new THREE.Vector3(Math.cos(this.aisleAngle) * 12.5, 2.6, -Math.sin(this.aisleAngle) * 12.5);
    const from = movers.map((i) => this.seatPos[i].clone());
    const to = movers.map((_, j) =>
      centre
        .clone()
        .add(new THREE.Vector3(((j % 3) - 1) * 0.7, 0.4 + Math.floor(j / 3) * 0.2, Math.floor(j / 3) * 0.7)),
    );
    const fromColors = movers.map((i) => this.seatColors[i].clone());
    const target = new THREE.Color(toColor);
    const stagger = 0.12;
    const p = new THREE.Vector3();

    sound.play('footsteps', 2.8 / animationSpeed());
    await this.stage.tween(2.8, (k) => {
      movers.forEach((i, j) => {
        // Each MP sets off a little after the previous one.
        const local = THREE.MathUtils.clamp(k * (1 + stagger * (movers.length - 1)) - j * stagger, 0, 1);
        const e = easeInOut(local);
        // A curve through the aisle, with a little walking bob.
        const a = from[j].clone().lerp(aisle, e);
        const b = aisle.clone().lerp(to[j], e);
        p.copy(a).lerp(b, e);
        this.seatPos[i].copy(p);
        this.setSeat(i, local > 0 && local < 1 ? Math.abs(Math.sin(local * Math.PI * 10)) * 0.25 : 0);
        this.seatColors[i].copy(fromColors[j]).lerp(target, THREE.MathUtils.clamp((local - 0.4) / 0.3, 0, 1));
        this.seats.setColorAt(i, this.seatColors[i]);
      });
      this.seats.instanceMatrix.needsUpdate = true;
      this.seats.instanceColor!.needsUpdate = true;
    });
  }

  /** Centre of a party's benches (null if it holds no seats). */
  benchCentre(id: number): THREE.Vector3 | null {
    const mine = this.seatsOf(id);
    if (!mine.length) return null;
    const c = new THREE.Vector3();
    for (const i of mine) c.add(this.seatPos[i]);
    return c.divideScalar(mine.length);
  }

  /** A party's MPs, in seating order. */
  private seatsOf(id: number): number[] {
    return this.seatOwner
      .map((owner, i) => (owner === id ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => this.seatSlot[a] - this.seatSlot[b]);
  }
}
