import * as THREE from 'three';
import { oppositionLeader } from '../../core/rules';
import type { PartyDef, Player } from '../../core/types';
import { L } from '../../i18n';
import { easeInOut } from '../animation';
import { END_GAP, LEADER_SCALE, polar } from '../layout';
import { makeLeader } from '../models';
import type { Stage } from '../Stage';
import { nameplateTexture } from '../textures/labels';
import type { Chamber } from './Chamber';

export type LeaderRole = 'pm' | 'opp';

/** Radius of the walkway in front of the benches (between the wheel and the first row). */
const WALKWAY_R = 7.35;

/**
 * The Prime Minister and the Leader of the Opposition. Each has a dais at one end of the hemicycle (the PM at
 * the government end, on the right) with a high-backed chair and a lectern with a microphone. When a new leader
 * takes office, their figure walks from the party's benches to the chair.
 */
export class Leaders {
  private readonly seated: Record<LeaderRole, { id: number; figure: THREE.Group } | null> = { pm: null, opp: null };
  /** Bumped whenever a role changes hands, so an outdated walk stops. */
  private readonly generation = { pm: 0, opp: 0 };

  constructor(
    private readonly stage: Stage,
    private readonly chamber: Chamber,
  ) {
    this.buildStation('pm');
    this.buildStation('opp');
  }

  /** Chamber angle of a dais: the government end (right) for the PM, the opposition end (left) for its leader. */
  private daisAngle(role: LeaderRole): number {
    return role === 'pm' ? END_GAP / 2 : Math.PI - END_GAP / 2;
  }

  /** A point in a dais's own frame: `x` outward along the dais angle, `z` across it. */
  private stationPoint(role: LeaderRole, x: number, z: number, y: number): THREE.Vector3 {
    const phi = this.daisAngle(role);
    return new THREE.Vector3(x * Math.cos(phi) + z * Math.sin(phi), y, -x * Math.sin(phi) + z * Math.cos(phi));
  }

  /**
   * A dais at the end of the chamber: a raised platform with a high-backed chair, and right in front of it a
   * lectern with a microphone facing the chamber. Wide enough to walk past the lectern on either side.
   */
  private buildStation(role: LeaderRole): void {
    const station = new THREE.Group();
    station.rotation.y = this.daisAngle(role); // local +x points outward along the dais angle
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.55 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a83a, metalness: 0.85, roughness: 0.3 });
    const leather = new THREE.MeshStandardMaterial({ color: role === 'pm' ? 0x1f6b3a : 0x7a1f2b, roughness: 0.6 });
    const add = (mesh: THREE.Mesh, x: number, y: number, z = 0) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      station.add(mesh);
      return mesh;
    };
    // Dais with a step and a gold edge.
    add(
      new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.36, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }),
      ),
      10.6,
      0.18,
    );
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 2.2), wood), 8.1, 0.09);
    add(new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.05, 2.52), gold), 10.6, 0.37);
    // High-backed chair at the back of the dais, facing the chamber.
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.1), wood), 12.1, 0.62);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.1), leather), 12.1, 0.94);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.9, 1.2), leather), 12.6, 1.45);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 1.3), gold), 12.6, 2.45);
    for (const z of [-0.6, 0.6]) add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), gold), 12.1, 1.25, z);
    // Lectern right in front of the chair: a tapered stand, a slanted top and a name plate facing the chamber.
    const LX = 11.0;
    const stand = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 4, 1), wood), LX, 0.96);
    stand.rotation.y = Math.PI / 4;
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.05), wood), LX, 1.6);
    top.rotation.z = 0.28;
    const title =
      role === 'pm' ? L('PRIME MINISTER', 'PRIMEIRO-MINISTRO') : L('LEADER OF THE OPPOSITION', 'LÍDER DA OPOSIÇÃO');
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.4),
      new THREE.MeshBasicMaterial({
        map: nameplateTexture(title, role === 'pm' ? '#57e389' : '#ff6b6b'),
        toneMapped: false,
      }),
    );
    plate.position.set(LX - 0.42, 1.08, 0);
    plate.rotation.y = -Math.PI / 2;
    station.add(plate);
    // Gooseneck microphone, bending toward the chair, with a red "on air" light.
    const mic = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.35 });
    const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mic), LX + 0.22, 1.9);
    neck.rotation.z = -0.55;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mic), LX + 0.38, 2.15);
    add(
      new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })),
      LX + 0.1,
      1.68,
      0.3,
    );
    this.stage.scene.add(station);
  }

  /** Where a leader sits: in the chair (a figure's origin sits 0.3 × LEADER_SCALE above what it stands on). */
  private chairSpot(role: LeaderRole): THREE.Vector3 {
    return this.stationPoint(role, 12.05, 0, 1.01 + 0.3 * LEADER_SCALE);
  }

  /** Turns a figure to face along `dir` (its bowtie side forward). */
  private faceToward(figure: THREE.Object3D, dir: THREE.Vector3): void {
    if (dir.x * dir.x + dir.z * dir.z > 1e-6) figure.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /** Seats a figure in its chair, facing the chamber. */
  private sitDown(role: LeaderRole, figure: THREE.Object3D): void {
    figure.position.copy(this.chairSpot(role));
    figure.rotation.set(0, 0, 0);
    this.faceToward(figure, this.stationPoint(role, -1, 0, 0).sub(this.stationPoint(role, 0, 0, 0)));
  }

  /** Removes the current figure for a role (it shrinks away). */
  private remove(role: LeaderRole): void {
    const current = this.seated[role];
    if (!current) return;
    this.seated[role] = null;
    this.generation[role]++;
    const figure = current.figure;
    void this.stage
      .tween(0.5, (k) => figure.scale.setScalar(Math.max(0.001, 1 - k)))
      .then(() => this.stage.scene.remove(figure));
  }

  /** Seats a leader at once, without the walk (used behind the title screen). */
  place(role: LeaderRole, player: { id: number; party: PartyDef }): void {
    this.remove(role);
    const figure = makeLeader(player.party);
    this.sitDown(role, figure);
    this.stage.scene.add(figure);
    this.seated[role] = { id: player.id, figure };
  }

  /**
   * Walks a leader from their party's benches down to the walkway, around the wheel, up the dais steps along
   * the side (past the lectern, not through it) and into the chair. With `camera`, the cinematic camera follows.
   */
  async walk(role: LeaderRole, player: { id: number; party: PartyDef }, camera: boolean): Promise<void> {
    const { stage } = this;
    this.remove(role);
    const generation = ++this.generation[role];
    await stage.wait(1.4); // let the MPs finish moving to their new benches first
    if (generation !== this.generation[role]) return;

    const figure = makeLeader(player.party);
    const lift = 0.3 * LEADER_SCALE;
    const start = this.chamber.benchCentre(player.id) ?? this.chairSpot(role);
    const startAngle = Math.atan2(-start.z, start.x);
    const endAngle = this.daisAngle(role);
    // Walk up the side of the dais that faces away from the benches.
    const side = role === 'pm' ? 0.95 : -0.95;

    // The route, as a list of points.
    const route: THREE.Vector3[] = [start.clone().setY(start.y - 0.3 + lift)];
    const steps = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / 0.15));
    for (let s = 0; s <= steps; s++)
      route.push(polar(WALKWAY_R, startAngle + ((endAngle - startAngle) * s) / steps, lift));
    route.push(
      this.stationPoint(role, 7.6, side, lift),
      this.stationPoint(role, 8.1, side, 0.18 + lift), // up the step
      this.stationPoint(role, 8.6, side, 0.38 + lift), // onto the dais
    );
    const besideChair = this.stationPoint(role, 11.85, side, 0.38 + lift);
    route.push(besideChair);

    const legs = route.slice(1).map((q, i) => q.distanceTo(route[i]));
    const total = legs.reduce((a, b) => a + b, 0);
    /** The point at distance `d` along the route. */
    const along = (d: number) => {
      for (let i = 0; i < legs.length; i++) {
        if (d <= legs[i] || i === legs.length - 1)
          return route[i].clone().lerp(route[i + 1], Math.min(1, d / (legs[i] || 1)));
        d -= legs[i];
      }
      return besideChair.clone();
    };

    figure.position.copy(route[0]);
    figure.scale.setScalar(0.001);
    stage.scene.add(figure);
    this.seated[role] = { id: player.id, figure };
    if (camera && stage.director.cinematic) {
      stage.director.frame(() => {
        const f = figure.position;
        return {
          pos: new THREE.Vector3(f.x * 0.55, f.y + 7.5, f.z + 12),
          target: new THREE.Vector3(f.x, f.y + 0.8, f.z),
          rate: 2.4,
        };
      });
    }

    // Pop up out of the benches, then walk with a little bob and sway.
    await stage.tween(0.35, (k) => figure.scale.setScalar(Math.max(0.001, k)));
    const duration = THREE.MathUtils.clamp(total / 5.5, 2.4, 4.8);
    const previous = new THREE.Vector3();
    await stage.tween(duration, (k) => {
      if (generation !== this.generation[role]) return;
      previous.copy(figure.position);
      const next = along(easeInOut(k) * total);
      this.faceToward(figure, next.clone().sub(previous));
      figure.position.copy(next);
      figure.position.y += Math.abs(Math.sin(k * duration * Math.PI * 3.2)) * 0.18;
      figure.rotation.z = Math.sin(k * duration * Math.PI * 3.2) * 0.08;
    });
    if (generation !== this.generation[role]) return;
    figure.rotation.z = 0;

    // Hop sideways into the chair, turning to face the chamber the short way round.
    const seat = this.chairSpot(role);
    const turnFrom = figure.rotation.y;
    this.sitDown(role, figure);
    const turnTo = figure.rotation.y;
    const turn = Math.atan2(Math.sin(turnTo - turnFrom), Math.cos(turnTo - turnFrom));
    await stage.tween(0.6, (k) => {
      const e = easeInOut(k);
      figure.position.lerpVectors(besideChair, seat, e);
      figure.position.y += Math.sin(k * Math.PI) * 0.5;
      figure.rotation.y = turnFrom + turn * e;
    });
    this.sitDown(role, figure);
  }

  /**
   * Keeps the figures in step with parliament: the PM leaves when they lose office; the Opposition Leader is the
   * largest opposition party. A new government is seated first (then the opposition ceremony walks its leader in);
   * mid-year changes walk in on their own.
   */
  update(players: Player[]): void {
    const pm = players.find((q) => q.isPM);
    if (this.seated.pm && (!pm || pm.id !== this.seated.pm.id)) this.remove('pm');
    const leader = oppositionLeader(players);
    if (!leader) this.remove('opp');
    else if (leader.id !== this.seated.opp?.id && pm && this.seated.pm?.id === pm.id)
      void this.walk('opp', leader, false);
  }
}
